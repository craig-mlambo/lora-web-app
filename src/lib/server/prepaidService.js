import { getDb } from './db.js';

/**
 * @param {import('postgres').TransactionSql} tx
 * @param {string} profileId
 */
async function assertActiveProfile(tx, profileId) {
	const [profile] = await tx`
		select
			profile.id,
			profile.account_status,
			coalesce(
				array_agg(role.code) filter (where role.code is not null),
				'{}'
			) as roles,
			coalesce(
				bool_or(
					role.id = '83d87215-37f2-4d3b-ab33-7600f7e7ae9b'::uuid
					or lower(role.code) = 'admin'
				),
				false
			) as is_admin
		from public.profiles profile
		left join public.profile_roles profile_role
		  on profile_role.profile_id = profile.id
		left join public.user_roles role
		  on role.id = profile_role.role_id
		where profile.id = ${profileId}
		group by profile.id, profile.account_status
	`;

	if (!profile || profile.account_status !== 'active') {
		throw new Error('An active profile is required.');
	}

	return profile;
}

/**
 * @param {import('postgres').TransactionSql} tx
 * @param {string} profileId
 */
async function assertAdmin(tx, profileId) {
	const profile = await assertActiveProfile(tx, profileId);
	if (!profile.is_admin) {
		throw new Error('Administrator access is required.');
	}
}

/**
 * Creates the household, its owner membership, and prepaid account atomically.
 *
 * @param {{
 *   actorId: string,
 *   ownerProfileId: string,
 *   accountNumber: string,
 *   name: string,
 *   addressLine1: string,
 *   addressLine2?: string,
 *   suburb?: string,
 *   city?: string,
 *   province?: string,
 *   postalCode?: string,
 *   timezone?: string,
 *   currency: string
 * }} input
 */
export async function createHouseholdWithPrepaidAccount(input) {
	const sql = getDb();

	return sql.begin(async (tx) => {
		await assertAdmin(tx, input.actorId);

		const [owner] = await tx`
			select id
			from public.profiles
			where id = ${input.ownerProfileId}
			  and account_status = 'active'
			for share
		`;
		if (!owner) throw new Error('The household owner must have an active profile.');

		const [household] = await tx`
			insert into public.households (
				owner_profile_id,
				account_number,
				name,
				address_line_1,
				address_line_2,
				suburb,
				city,
				province,
				postal_code,
				timezone
			)
			values (
				${input.ownerProfileId},
				${input.accountNumber},
				${input.name},
				${input.addressLine1},
				${input.addressLine2 ?? null},
				${input.suburb ?? null},
				${input.city ?? null},
				${input.province ?? null},
				${input.postalCode ?? null},
				${input.timezone ?? 'Africa/Harare'}
			)
			returning *
		`;

		await tx`
			insert into public.household_members (
				household_id,
				profile_id,
				access_level,
				relationship,
				status
			)
			values (
				${household.id},
				${input.ownerProfileId},
				'owner',
				'Primary account holder',
				'active'
			)
		`;

		const [account] = await tx`
			insert into public.prepaid_accounts (household_id, currency)
			values (${household.id}, ${input.currency.toUpperCase()})
			returning *
		`;

		return { household, account };
	});
}

/**
 * Changes the primary household owner and keeps membership records consistent.
 *
 * @param {{actorId:string, householdId:string, newOwnerProfileId:string}} input
 */
export async function changeHouseholdOwner(input) {
	const sql = getDb();

	return sql.begin(async (tx) => {
		await assertAdmin(tx, input.actorId);

		const [household] = await tx`
			select *
			from public.households
			where id = ${input.householdId}
			for update
		`;
		if (!household) throw new Error('Household was not found.');

		const [newOwner] = await tx`
			select id
			from public.profiles
			where id = ${input.newOwnerProfileId}
			  and account_status = 'active'
			for share
		`;
		if (!newOwner) throw new Error('The new owner must have an active profile.');

		await tx`
			insert into public.household_members (
				household_id,
				profile_id,
				access_level,
				relationship,
				status
			)
			values (
				${input.householdId},
				${input.newOwnerProfileId},
				'owner',
				'Primary account holder',
				'active'
			)
			on conflict (household_id, profile_id)
			do update set
				access_level = 'owner',
				relationship = 'Primary account holder',
				status = 'active'
		`;

		if (household.owner_profile_id !== input.newOwnerProfileId) {
			await tx`
				update public.household_members
				set
					access_level = 'viewer',
					status = 'revoked'
				where household_id = ${input.householdId}
				  and profile_id = ${household.owner_profile_id}
			`;
		}

		const [updated] = await tx`
			update public.households
			set
				owner_profile_id = ${input.newOwnerProfileId},
				updated_at = now()
			where id = ${input.householdId}
			returning *
		`;

		return updated;
	});
}

/**
 * Assigns or moves a device while preserving assignment history.
 *
 * @param {{
 *   actorId:string,
 *   deviceId:string,
 *   householdId:string,
 *   assignedProfileId?:string,
 *   notes?:string
 * }} input
 */
export async function assignDeviceToHousehold(input) {
	const sql = getDb();

	return sql.begin(async (tx) => {
		await assertAdmin(tx, input.actorId);

		const [device] = await tx`
			select *
			from public.devices
			where id = ${input.deviceId}
			for update
		`;
		if (!device) throw new Error('Device was not found.');

		const [household] = await tx`
			select id
			from public.households
			where id = ${input.householdId}
			  and status <> 'closed'
			for share
		`;
		if (!household) throw new Error('Target household was not found.');

		if (input.assignedProfileId) {
			const [membership] = await tx`
				select profile_id
				from public.household_members
				where household_id = ${input.householdId}
				  and profile_id = ${input.assignedProfileId}
				  and status = 'active'
				for share
			`;
			if (!membership) throw new Error('Assigned user is not an active household member.');
		}

		await tx`
			update public.device_assignments
			set unassigned_at = now()
			where device_id = ${input.deviceId}
			  and unassigned_at is null
		`;

		const [updatedDevice] = await tx`
			update public.devices
			set
				household_id = ${input.householdId},
				assigned_profile_id = ${input.assignedProfileId ?? null},
				updated_at = now()
			where id = ${input.deviceId}
			returning *
		`;

		const [assignment] = await tx`
			insert into public.device_assignments (
				device_id,
				household_id,
				assigned_profile_id,
				assigned_by_profile_id,
				notes
			)
			values (
				${input.deviceId},
				${input.householdId},
				${input.assignedProfileId ?? null},
				${input.actorId},
				${input.notes ?? null}
			)
			returning *
		`;

		return { device: updatedDevice, assignment };
	});
}

/**
 * Creates an idempotent pending payment intent for an accessible household.
 *
 * @param {{
 *   actorId: string,
 *   prepaidAccountId: string,
 *   provider: string,
 *   idempotencyKey: string,
 *   amount: number,
 *   currency: string,
 *   metadata?: import('postgres').JSONValue
 * }} input
 */
export async function createPaymentIntent(input) {
	const sql = getDb();

	return sql.begin(async (tx) => {
		await assertActiveProfile(tx, input.actorId);

		const [account] = await tx`
			select account.id, account.currency, account.status
			from public.prepaid_accounts account
			join public.households household on household.id = account.household_id
			left join public.household_members membership
			  on membership.household_id = household.id
			 and membership.profile_id = ${input.actorId}
			 and membership.status = 'active'
			where account.id = ${input.prepaidAccountId}
			  and (
			    household.owner_profile_id = ${input.actorId}
			    or membership.profile_id is not null
			  )
			for share
		`;

		if (!account || account.status !== 'active') {
			throw new Error('The prepaid account is not available.');
		}
		if (account.currency !== input.currency.toUpperCase()) {
			throw new Error('Payment currency does not match the prepaid account.');
		}
		if (!Number.isFinite(input.amount) || input.amount <= 0) {
			throw new Error('Payment amount must be positive.');
		}

		const rows = await tx`
			insert into public.payments (
				prepaid_account_id,
				payer_profile_id,
				provider,
				idempotency_key,
				amount,
				currency,
				status,
				metadata
			)
			values (
				${input.prepaidAccountId},
				${input.actorId},
				${input.provider},
				${input.idempotencyKey},
				${input.amount},
				${input.currency.toUpperCase()},
				'pending',
				${tx.json(input.metadata ?? {})}
			)
			on conflict (idempotency_key) do nothing
			returning *
		`;

		if (rows[0]) return rows[0];

		const [existing] = await tx`
			select *
			from public.payments
			where idempotency_key = ${input.idempotencyKey}
			  and payer_profile_id = ${input.actorId}
		`;
		if (!existing) throw new Error('The idempotency key belongs to another payment.');

		return existing;
	});
}

/**
 * Verifies and settles a provider event, then creates the purchased water and
 * positive ledger entry in one transaction. Call only after validating the
 * provider webhook signature in SvelteKit.
 *
 * @param {{
 *   provider: string,
 *   providerEventId: string,
 *   providerReference: string,
 *   eventType: string,
 *   paymentId: string,
 *   tariffId: string,
 *   purchasedLitres: number,
 *   bonusLitres?: number,
 *   paidAt: string | Date,
 *   payload: import('postgres').JSONValue
 * }} input
 */
export async function settlePaymentAndCreditWater(input) {
	const sql = getDb();

	return sql.begin(async (tx) => {
		const eventRows = await tx`
			insert into public.payment_events (
				payment_id,
				provider,
				provider_event_id,
				event_type,
				payload
			)
			values (
				${input.paymentId},
				${input.provider},
				${input.providerEventId},
				${input.eventType},
				${tx.json(input.payload)}
			)
			on conflict (provider, provider_event_id) do nothing
			returning id
		`;

		if (!eventRows[0]) {
			const [existingPurchase] = await tx`
				select *
				from public.water_credit_purchases
				where payment_id = ${input.paymentId}
			`;
			return { duplicate: true, purchase: existingPurchase ?? null };
		}

		const [payment] = await tx`
			select
				payment.*,
				account.currency as account_currency,
				account.status as account_status,
				tariff.currency as tariff_currency,
				tariff.status as tariff_status,
				tariff.effective_from as tariff_effective_from,
				tariff.effective_to as tariff_effective_to
			from public.payments payment
			join public.prepaid_accounts account
			  on account.id = payment.prepaid_account_id
			join public.tariffs tariff
			  on tariff.id = ${input.tariffId}
			where payment.id = ${input.paymentId}
			  and payment.provider = ${input.provider}
			for update
		`;

		if (!payment) throw new Error('Payment or tariff was not found.');
		if (payment.status === 'succeeded') {
			throw new Error('Successful payment has no matching processed provider event.');
		}
		if (!['pending', 'processing'].includes(payment.status)) {
			throw new Error(`Payment cannot be settled from status ${payment.status}.`);
		}
		if (
			payment.currency !== payment.account_currency ||
			payment.currency !== payment.tariff_currency
		) {
			throw new Error('Payment, account, and tariff currencies do not match.');
		}
		if (payment.account_status !== 'active') {
			throw new Error('The prepaid account is not active.');
		}

		const purchasedLitres = Number(input.purchasedLitres);
		const bonusLitres = Number(input.bonusLitres ?? 0);
		if (!Number.isFinite(purchasedLitres) || purchasedLitres <= 0 || bonusLitres < 0) {
			throw new Error('Purchased and bonus litres are invalid.');
		}

		const paidAt = new Date(input.paidAt);
		if (Number.isNaN(paidAt.getTime())) throw new Error('paidAt must be a valid timestamp.');
		if (
			payment.tariff_status === 'draft' ||
			paidAt < new Date(payment.tariff_effective_from) ||
			(payment.tariff_effective_to && paidAt >= new Date(payment.tariff_effective_to))
		) {
			throw new Error('The tariff was not effective when the payment completed.');
		}

		await tx`
			update public.payments
			set
				status = 'succeeded',
				provider_reference = ${input.providerReference},
				paid_at = ${paidAt},
				updated_at = now()
			where id = ${payment.id}
		`;

		const [purchase] = await tx`
			insert into public.water_credit_purchases (
				prepaid_account_id,
				payment_id,
				tariff_id,
				paid_amount,
				currency,
				purchased_litres,
				bonus_litres,
				purchased_at,
				pricing_snapshot
			)
			values (
				${payment.prepaid_account_id},
				${payment.id},
				${input.tariffId},
				${payment.amount},
				${payment.currency},
				${purchasedLitres},
				${bonusLitres},
				${paidAt},
				${tx.json({
					paymentAmount: payment.amount,
					currency: payment.currency,
					tariffId: input.tariffId
				})}
			)
			returning *
		`;

		await tx`
			insert into public.water_ledger_entries (
				prepaid_account_id,
				entry_type,
				litres_delta,
				purchase_id,
				description,
				occurred_at
			)
			values (
				${payment.prepaid_account_id},
				'purchase',
				${purchasedLitres + bonusLitres},
				${purchase.id},
				'Prepaid water purchase',
				${paidAt}
			)
		`;

		await tx`
			update public.payment_events
			set processed_at = now()
			where provider = ${input.provider}
			  and provider_event_id = ${input.providerEventId}
		`;

		return { duplicate: false, purchase };
	});
}

/**
 * Queues purchased litres for a meter without allowing allocations to exceed
 * the volume bought.
 *
 * @param {{
 *   purchaseId:string,
 *   deviceId:string,
 *   litres:number,
 *   idempotencyKey:string,
 *   metadata?:import('postgres').JSONValue
 * }} input
 */
export async function allocatePurchasedCredit(input) {
	const sql = getDb();

	return sql.begin(async (tx) => {
		const [purchase] = await tx`
			select
				purchase.*,
				account.household_id
			from public.water_credit_purchases purchase
			join public.prepaid_accounts account
			  on account.id = purchase.prepaid_account_id
			where purchase.id = ${input.purchaseId}
			for update
		`;
		if (!purchase) throw new Error('Water-credit purchase was not found.');

		const [device] = await tx`
			select id
			from public.devices
			where id = ${input.deviceId}
			  and household_id = ${purchase.household_id}
			  and status = 'active'
			for share
		`;
		if (!device) throw new Error('Device is not an active meter for the purchase household.');

		const litres = Number(input.litres);
		if (!Number.isFinite(litres) || litres <= 0) {
			throw new Error('Allocated litres must be positive.');
		}

		const [totals] = await tx`
			select coalesce(sum(litres), 0) as already_allocated
			from public.meter_credit_allocations
			where purchase_id = ${input.purchaseId}
			  and status not in ('failed', 'cancelled')
		`;
		const available =
			Number(purchase.purchased_litres) +
			Number(purchase.bonus_litres) -
			Number(totals.already_allocated);
		if (litres > available) throw new Error('Allocation exceeds unallocated purchased litres.');

		const rows = await tx`
			insert into public.meter_credit_allocations (
				purchase_id,
				device_id,
				litres,
				idempotency_key,
				status,
				metadata
			)
			values (
				${input.purchaseId},
				${input.deviceId},
				${litres},
				${input.idempotencyKey},
				'queued',
				${tx.json(input.metadata ?? {})}
			)
			on conflict (idempotency_key) do nothing
			returning *
		`;

		if (rows[0]) return rows[0];

		const [existing] = await tx`
			select *
			from public.meter_credit_allocations
			where idempotency_key = ${input.idempotencyKey}
			  and purchase_id = ${input.purchaseId}
		`;
		if (!existing) throw new Error('The idempotency key belongs to another allocation.');

		return existing;
	});
}

/**
 * Posts an exact, auditable reversal rather than editing ledger history.
 *
 * @param {{actorId:string, ledgerEntryId:string, reason:string}} input
 */
export async function reverseLedgerEntry(input) {
	const sql = getDb();

	return sql.begin(async (tx) => {
		await assertAdmin(tx, input.actorId);

		const [entry] = await tx`
			select *
			from public.water_ledger_entries
			where id = ${input.ledgerEntryId}
			for update
		`;
		if (!entry) throw new Error('Ledger entry was not found.');

		const [reversal] = await tx`
			insert into public.water_ledger_entries (
				prepaid_account_id,
				entry_type,
				litres_delta,
				reversal_of_id,
				description,
				created_by_profile_id,
				occurred_at
			)
			values (
				${entry.prepaid_account_id},
				'reversal',
				${-Number(entry.litres_delta)},
				${entry.id},
				${input.reason},
				${input.actorId},
				now()
			)
			returning *
		`;

		return reversal;
	});
}

/**
 * Inserts a unique meter reading, calculates usage from the preceding
 * cumulative reading, and posts the consumption debit atomically.
 *
 * @param {{
 *   deviceId: string,
 *   sourceMessageId: string,
 *   frameCounter?: number,
 *   readingTime: string | Date,
 *   cumulativeLitres: number,
 *   intervalLitres?: number,
 *   instantFlowLpm?: number,
 *   reverseFlowLitres?: number,
 *   remainingCreditLitres?: number,
 *   batteryPercent?: number,
 *   rssi?: number,
 *   snr?: number,
 *   valveState?: 'open'|'closed'|'unknown',
 *   checksumOk?: boolean,
 *   rawPayload?: import('postgres').JSONValue
 * }} input
 */
export async function ingestDeviceReading(input) {
	const sql = getDb();

	return sql.begin(async (tx) => {
		const [device] = await tx`
			select
				device.id,
				device.household_id,
				account.id as prepaid_account_id
			from public.devices device
			join public.prepaid_accounts account
			  on account.household_id = device.household_id
			where device.id = ${input.deviceId}
			  and device.status in ('active', 'faulty')
			for update
		`;
		if (!device) throw new Error('Device or prepaid account was not found.');

		const readingTime = new Date(input.readingTime);
		if (Number.isNaN(readingTime.getTime())) {
			throw new Error('readingTime must be a valid timestamp.');
		}
		const cumulativeLitres = Number(input.cumulativeLitres);
		if (!Number.isFinite(cumulativeLitres) || cumulativeLitres < 0) {
			throw new Error('cumulativeLitres must be zero or greater.');
		}

		const readingRows = await tx`
			insert into public.device_readings (
				device_id,
				source_message_id,
				frame_counter,
				reading_time,
				cumulative_litres,
				interval_litres,
				instant_flow_lpm,
				reverse_flow_litres,
				remaining_credit_litres,
				battery_percent,
				rssi,
				snr,
				valve_state,
				checksum_ok,
				raw_payload
			)
			values (
				${input.deviceId},
				${input.sourceMessageId},
				${input.frameCounter ?? null},
				${readingTime},
				${cumulativeLitres},
				${input.intervalLitres ?? null},
				${input.instantFlowLpm ?? null},
				${input.reverseFlowLitres ?? null},
				${input.remainingCreditLitres ?? null},
				${input.batteryPercent ?? null},
				${input.rssi ?? null},
				${input.snr ?? null},
				${input.valveState ?? null},
				${input.checksumOk ?? null},
				${tx.json(input.rawPayload ?? {})}
			)
			on conflict (source_message_id) do nothing
			returning *
		`;

		if (!readingRows[0]) {
			const [existing] = await tx`
				select *
				from public.device_readings
				where source_message_id = ${input.sourceMessageId}
			`;
			return { duplicate: true, reading: existing, consumption: null };
		}

		const reading = readingRows[0];
		await tx`
			update public.devices
			set
				last_seen_at = ${readingTime},
				valve_state = coalesce(${input.valveState ?? null}, valve_state),
				updated_at = now()
			where id = ${input.deviceId}
		`;

		const [previous] = await tx`
			select *
			from public.device_readings
			where device_id = ${input.deviceId}
			  and id <> ${reading.id}
			  and reading_time <= ${readingTime}
			order by reading_time desc, id desc
			limit 1
		`;

		const consumedLitres = previous
			? cumulativeLitres - Number(previous.cumulative_litres)
			: Number(input.intervalLitres ?? 0);

		if (consumedLitres < 0) {
			return {
				duplicate: false,
				reading,
				consumption: null,
				meterResetRequired: true
			};
		}

		const [consumption] = await tx`
			insert into public.consumption_events (
				prepaid_account_id,
				device_id,
				from_reading_id,
				to_reading_id,
				consumed_litres,
				started_at,
				ended_at
			)
			values (
				${device.prepaid_account_id},
				${input.deviceId},
				${previous?.id ?? null},
				${reading.id},
				${consumedLitres},
				${previous?.reading_time ?? null},
				${readingTime}
			)
			returning *
		`;

		if (consumedLitres > 0) {
			await tx`
				insert into public.water_ledger_entries (
					prepaid_account_id,
					entry_type,
					litres_delta,
					consumption_event_id,
					description,
					occurred_at
				)
				values (
					${device.prepaid_account_id},
					'consumption',
					${-consumedLitres},
					${consumption.id},
					'Metered water consumption',
					${readingTime}
				)
			`;
		}

		return {
			duplicate: false,
			reading,
			consumption,
			meterResetRequired: false
		};
	});
}
