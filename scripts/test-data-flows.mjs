/**
 * End-to-end test of the three workspaces against the deployed backend.
 *
 *   node scripts/test-data-flows.mjs
 *
 * Walks the real journey — admin creates a service and a supervisor, the
 * supervisor creates an order for a customer, the customer tracks it and chats —
 * and then checks the negative cases that matter: one customer must not be able
 * to read another's order, and a guest must not be able to edit the catalog.
 *
 * All test numbers are in the +1 555-01xx range reserved for fiction, so no real
 * handset is ever texted. Everything created is deleted at the end.
 */
import {
  createReporter,
  deleteUser,
  gqlAsGuest,
  gqlAsUser,
  isUnauthorized,
  provisionUser,
  signInWithOtp,
  GRAPHQL_URL,
  REGION,
} from './lib/backend-test-kit.mjs';

const r = createReporter();

const ADMIN = { phone: '+15550101001', name: 'Test Admin' };
const SUPERVISOR = { phone: '+15550101002', name: 'Test Supervisor' };
const CUSTOMER_A = { phone: '+15550101003', name: 'Test Customer A' };
const CUSTOMER_B = { phone: '+15550101004', name: 'Test Customer B' };

const created = { users: [], serviceId: null, orderId: null, supervisorProfileId: null };

console.log(`\nStars data-flow test (${REGION})`);
console.log(`  api ${GRAPHQL_URL}\n`);

try {
  /* ---------------------------------------------------------------- *
   * Sign-in for every role
   * ---------------------------------------------------------------- */
  const admin = await provisionUser(ADMIN.phone, ADMIN.name, 'ADMIN');
  const customerA = await provisionUser(CUSTOMER_A.phone, CUSTOMER_A.name, 'CUSTOMER');
  const customerB = await provisionUser(CUSTOMER_B.phone, CUSTOMER_B.name, 'CUSTOMER');
  created.users.push(admin.username, customerA.username, customerB.username);

  const adminToken = await signInWithOtp(ADMIN.phone);
  r.ok('admin signs in with an SMS code');

  /* ---------------------------------------------------------------- *
   * Admin builds the catalog
   * ---------------------------------------------------------------- */
  const serviceResult = await gqlAsUser(
    adminToken,
    `mutation Create($input: CreateServiceInput!) {
       createService(input: $input) { id name steps isActive }
     }`,
    {
      input: {
        name: 'Test Detailing Package',
        nameAr: 'باقة اختبار',
        price: 450,
        currency: 'QAR',
        isActive: true,
        sortOrder: 0,
        // AWSJSON is a string on the wire — same as the app's toJsonField().
        steps: JSON.stringify([
          { key: 's1', name: 'Wash', nameAr: 'غسيل' },
          { key: 's2', name: 'Polish', nameAr: 'تلميع' },
          { key: 's3', name: 'PPF Protection', nameAr: 'حماية' },
        ]),
      },
    },
  );
  created.serviceId = serviceResult.data?.createService?.id;
  r.expect(!!created.serviceId, 'admin creates a service with 3 steps', serviceResult.errors?.[0]?.message);

  /* ---------------------------------------------------------------- *
   * Admin creates a supervisor through the Lambda mutation
   * ---------------------------------------------------------------- */
  const supervisorResult = await gqlAsUser(
    adminToken,
    `mutation Create($name: String!, $phone: String!, $description: String) {
       createSupervisor(name: $name, phone: $phone, description: $description) {
         ok code message userId phone
       }
     }`,
    { name: SUPERVISOR.name, phone: SUPERVISOR.phone, description: 'Automated test' },
  );
  const supervisorPayload = supervisorResult.data?.createSupervisor;
  created.supervisorProfileId = supervisorPayload?.userId ?? null;
  r.expect(
    supervisorPayload?.ok === true,
    'admin creates a supervisor account',
    supervisorPayload?.message ?? supervisorResult.errors?.[0]?.message,
  );

  const supervisorToken = await signInWithOtp(SUPERVISOR.phone);
  r.ok('supervisor signs in with an SMS code');

  const supervisorClaims = JSON.parse(
    Buffer.from(supervisorToken.split('.')[1], 'base64url').toString('utf8'),
  );
  r.expect(
    (supervisorClaims['cognito:groups'] ?? []).includes('SUPERVISOR'),
    'supervisor lands in the SUPERVISOR group',
    JSON.stringify(supervisorClaims['cognito:groups']),
  );

  /* ---------------------------------------------------------------- *
   * Supervisor creates a customer account and an order
   * ---------------------------------------------------------------- */
  const accountResult = await gqlAsUser(
    supervisorToken,
    `mutation Ensure($name: String!, $phone: String!) {
       ensureCustomerAccount(name: $name, phone: $phone) { ok code userId orderId }
     }`,
    { name: CUSTOMER_A.name, phone: CUSTOMER_A.phone },
  );
  const account = accountResult.data?.ensureCustomerAccount;
  r.expect(account?.ok === true, 'supervisor provisions the customer account', account?.code);
  r.expect(
    account?.userId === customerA.sub,
    'returned owner id matches the customer Cognito sub',
  );

  const orderResult = await gqlAsUser(
    supervisorToken,
    `mutation Create($input: CreateOrderInput!) {
       createOrder(input: $input) { id orderNumber status customerOwner totalStepCount }
     }`,
    {
      input: {
        orderNumber: 'STR-TEST-0001',
        status: 'SCHEDULED',
        source: 'STAFF',
        createdAtIso: new Date().toISOString(),
        customerOwner: account.userId,
        customerName: CUSTOMER_A.name,
        customerPhone: CUSTOMER_A.phone,
        vehicleMake: 'Toyota',
        vehicleModel: 'Land Cruiser',
        totalAmount: 450,
        currency: 'QAR',
        totalStepCount: 3,
        completedStepCount: 0,
        currentStepOrder: 0,
      },
    },
  );
  created.orderId = orderResult.data?.createOrder?.id;
  r.expect(!!created.orderId, 'supervisor creates an order', orderResult.errors?.[0]?.message);

  const stepNames = ['Wash', 'Polish', 'PPF Protection'];
  const stepIds = [];
  for (const [index, name] of stepNames.entries()) {
    const stepResult = await gqlAsUser(
      supervisorToken,
      `mutation Create($input: CreateOrderStepInput!) {
         createOrderStep(input: $input) { id name status sortOrder }
       }`,
      {
        input: {
          orderId: created.orderId,
          customerOwner: account.userId,
          sortOrder: index,
          name,
          status: index === 0 ? 'IN_PROGRESS' : 'PENDING',
          imageKeys: [],
        },
      },
    );
    if (stepResult.data?.createOrderStep?.id) stepIds.push(stepResult.data.createOrderStep.id);
  }
  r.expect(stepIds.length === 3, 'roadmap steps are created', `${stepIds.length}/3`);

  /* ---------------------------------------------------------------- *
   * Customer A tracks their own order
   * ---------------------------------------------------------------- */
  const customerAToken = await signInWithOtp(CUSTOMER_A.phone);
  r.ok('customer signs in with an SMS code');

  const myOrders = await gqlAsUser(
    customerAToken,
    `query Mine($owner: String!) {
       ordersByCustomerOwner(customerOwner: $owner, sortDirection: DESC) {
         items { id orderNumber status }
       }
     }`,
    { owner: account.userId },
  );
  const myOrderIds = (myOrders.data?.ordersByCustomerOwner?.items ?? []).map((o) => o.id);
  r.expect(
    myOrderIds.includes(created.orderId),
    'customer sees their own order in Track',
    myOrders.errors?.[0]?.message,
  );

  const mySteps = await gqlAsUser(
    customerAToken,
    `query Steps($orderId: ID!) {
       stepsByOrder(orderId: $orderId, sortDirection: ASC) {
         items { id name status sortOrder }
       }
     }`,
    { orderId: created.orderId },
  );
  r.expect(
    (mySteps.data?.stepsByOrder?.items ?? []).length === 3,
    'customer sees the full roadmap',
    mySteps.errors?.[0]?.message,
  );

  /* ---------------------------------------------------------------- *
   * Row-level isolation: customer B must not reach customer A's order
   * ---------------------------------------------------------------- */
  const customerBToken = await signInWithOtp(CUSTOMER_B.phone);
  const otherOrder = await gqlAsUser(
    customerBToken,
    `query Get($id: ID!) { getOrder(id: $id) { id customerName } }`,
    { id: created.orderId },
  );
  r.expect(
    !otherOrder.data?.getOrder,
    'another customer cannot read this order',
    otherOrder.data?.getOrder ? 'LEAKED' : '',
  );

  const otherSteps = await gqlAsUser(
    customerBToken,
    `query Steps($orderId: ID!) {
       stepsByOrder(orderId: $orderId) { items { id name } }
     }`,
    { orderId: created.orderId },
  );
  r.expect(
    (otherSteps.data?.stepsByOrder?.items ?? []).length === 0,
    'another customer cannot read this roadmap',
  );

  /* ---------------------------------------------------------------- *
   * Customers must not be able to edit the catalog
   * ---------------------------------------------------------------- */
  const customerEdit = await gqlAsUser(
    customerAToken,
    `mutation Update($input: UpdateServiceInput!) {
       updateService(input: $input) { id name }
     }`,
    { input: { id: created.serviceId, name: 'Hacked' } },
  );
  r.expect(
    !customerEdit.data?.updateService,
    'customer cannot edit a service',
    customerEdit.data?.updateService ? 'LEAKED' : '',
  );

  const customerReadsCatalog = await gqlAsUser(
    customerAToken,
    `query List { listServices(limit: 5) { items { id name } } }`,
  );
  r.expect(
    (customerReadsCatalog.data?.listServices?.items ?? []).length > 0,
    'customer can still read the catalog',
  );

  /* ---------------------------------------------------------------- *
   * Chat, both directions
   * ---------------------------------------------------------------- */
  const customerMessage = await gqlAsUser(
    customerAToken,
    `mutation Send($input: CreateChatMessageInput!) {
       createChatMessage(input: $input) { id body senderRole }
     }`,
    {
      input: {
        orderId: created.orderId,
        createdAtIso: new Date().toISOString(),
        senderSub: customerA.sub,
        senderName: CUSTOMER_A.name,
        senderRole: 'CUSTOMER',
        body: 'Any update on my car?',
      },
    },
  );
  r.expect(
    !!customerMessage.data?.createChatMessage?.id,
    'customer can message the team',
    customerMessage.errors?.[0]?.message,
  );

  const staffReply = await gqlAsUser(
    supervisorToken,
    `mutation Send($input: CreateChatMessageInput!) {
       createChatMessage(input: $input) { id body senderRole }
     }`,
    {
      input: {
        orderId: created.orderId,
        customerOwner: account.userId,
        createdAtIso: new Date().toISOString(),
        senderSub: 'supervisor-sub',
        senderName: SUPERVISOR.name,
        senderRole: 'SUPERVISOR',
        body: 'Polishing now, ready by 4pm.',
      },
    },
  );
  r.expect(
    !!staffReply.data?.createChatMessage?.id,
    'supervisor can reply',
    staffReply.errors?.[0]?.message,
  );

  const thread = await gqlAsUser(
    customerAToken,
    `query Thread($orderId: ID!) {
       messagesByOrder(orderId: $orderId, sortDirection: ASC) {
         items { id body senderRole }
       }
     }`,
    { orderId: created.orderId },
  );
  r.expect(
    (thread.data?.messagesByOrder?.items ?? []).length === 2,
    'customer sees both sides of the conversation',
    `${(thread.data?.messagesByOrder?.items ?? []).length} messages`,
  );

  const otherThread = await gqlAsUser(
    customerBToken,
    `query Thread($orderId: ID!) {
       messagesByOrder(orderId: $orderId) { items { id body } }
     }`,
    { orderId: created.orderId },
  );
  r.expect(
    (otherThread.data?.messagesByOrder?.items ?? []).length === 0,
    'another customer cannot read the conversation',
  );

  /* ---------------------------------------------------------------- *
   * Guest paths: read the catalog, book, but never write
   * ---------------------------------------------------------------- */
  const guestCatalog = await gqlAsGuest(
    `query List { listServices(limit: 10) { items { id name price } } }`,
  );
  r.expect(
    (guestCatalog.data?.listServices?.items ?? []).length > 0,
    'a signed-out visitor can browse services',
    guestCatalog.errors?.[0]?.message,
  );

  const guestWrite = await gqlAsGuest(
    `mutation Create($input: CreateServiceInput!) { createService(input: $input) { id } }`,
    { input: { name: 'Guest injected', isActive: true } },
  );
  r.expect(
    !guestWrite.data?.createService && isUnauthorized(guestWrite),
    'a signed-out visitor cannot create a service',
    guestWrite.data?.createService ? 'LEAKED' : '',
  );

  const guestReadsOrder = await gqlAsGuest(
    `query Get($id: ID!) { getOrder(id: $id) { id customerName customerPhone } }`,
    { id: created.orderId },
  );
  r.expect(
    !guestReadsOrder.data?.getOrder,
    'a signed-out visitor cannot read an order',
    guestReadsOrder.data?.getOrder ? 'LEAKED' : '',
  );

  const guestBooking = await gqlAsGuest(
    `mutation Book($name: String!, $phone: String!, $selections: AWSJSON!) {
       submitPublicBooking(name: $name, phone: $phone, selections: $selections) {
         ok code orderNumber orderId
       }
     }`,
    {
      name: 'Walk-in Test',
      phone: CUSTOMER_B.phone,
      selections: JSON.stringify([{ kind: 'SERVICE', refId: created.serviceId }]),
    },
  );
  const booking = guestBooking.data?.submitPublicBooking;
  r.expect(
    booking?.ok === true,
    'a signed-out visitor can submit a booking',
    booking?.code ?? guestBooking.errors?.[0]?.message,
  );

  if (booking?.orderId) {
    const bookedOrder = await gqlAsUser(
      customerBToken,
      `query Get($id: ID!) { getOrder(id: $id) { id status source totalStepCount } }`,
      { id: booking.orderId },
    );
    r.expect(
      bookedOrder.data?.getOrder?.status === 'NEW',
      'the booking lands in the staff New tab',
      bookedOrder.data?.getOrder?.status,
    );
    r.expect(
      bookedOrder.data?.getOrder?.totalStepCount === 3,
      'the booking inherits the service roadmap',
      String(bookedOrder.data?.getOrder?.totalStepCount),
    );
    r.expect(
      !!bookedOrder.data?.getOrder,
      'the booking customer can track it straight away',
    );

    // Clean up the order the Lambda created.
    await gqlAsUser(
      adminToken,
      `mutation Del($input: DeleteOrderInput!) { deleteOrder(input: $input) { id } }`,
      { input: { id: booking.orderId } },
    );
  }

  /* ---------------------------------------------------------------- *
   * Staff visibility
   * ---------------------------------------------------------------- */
  const staffBoard = await gqlAsUser(
    supervisorToken,
    `query Board($status: String!) {
       ordersByStatus(status: $status, sortDirection: DESC) { items { id orderNumber } }
     }`,
    { status: 'SCHEDULED' },
  );
  r.expect(
    (staffBoard.data?.ordersByStatus?.items ?? []).some((o) => o.id === created.orderId),
    'the order appears on the staff board',
    staffBoard.errors?.[0]?.message,
  );
} catch (err) {
  r.fail('unexpected error', err?.message ?? String(err));
} finally {
  /* Cleanup */
  try {
    const adminToken = await signInWithOtp(ADMIN.phone);
    if (created.orderId) {
      const steps = await gqlAsUser(
        adminToken,
        `query Steps($orderId: ID!) { stepsByOrder(orderId: $orderId) { items { id } } }`,
        { orderId: created.orderId },
      );
      for (const step of steps.data?.stepsByOrder?.items ?? []) {
        await gqlAsUser(
          adminToken,
          `mutation Del($input: DeleteOrderStepInput!) { deleteOrderStep(input: $input) { id } }`,
          { input: { id: step.id } },
        );
      }
      const messages = await gqlAsUser(
        adminToken,
        `query Thread($orderId: ID!) { messagesByOrder(orderId: $orderId) { items { id } } }`,
        { orderId: created.orderId },
      );
      for (const message of messages.data?.messagesByOrder?.items ?? []) {
        await gqlAsUser(
          adminToken,
          `mutation Del($input: DeleteChatMessageInput!) { deleteChatMessage(input: $input) { id } }`,
          { input: { id: message.id } },
        );
      }
      await gqlAsUser(
        adminToken,
        `mutation Del($input: DeleteOrderInput!) { deleteOrder(input: $input) { id } }`,
        { input: { id: created.orderId } },
      );
    }
    if (created.serviceId) {
      await gqlAsUser(
        adminToken,
        `mutation Del($input: DeleteServiceInput!) { deleteService(input: $input) { id } }`,
        { input: { id: created.serviceId } },
      );
    }
    if (created.supervisorProfileId) {
      await gqlAsUser(
        adminToken,
        `mutation Del($supervisorId: ID!) { deleteSupervisor(supervisorId: $supervisorId) { ok } }`,
        { supervisorId: created.supervisorProfileId },
      );
    }
    // Customer profiles created along the way.
    for (const phone of [CUSTOMER_A.phone, CUSTOMER_B.phone]) {
      const profiles = await gqlAsUser(
        adminToken,
        `query ByPhone($phone: String!) {
           listCustomerProfileByPhone(phone: $phone) { items { id } }
         }`,
        { phone },
      );
      for (const profile of profiles.data?.listCustomerProfileByPhone?.items ?? []) {
        await gqlAsUser(
          adminToken,
          `mutation Del($input: DeleteCustomerProfileInput!) {
             deleteCustomerProfile(input: $input) { id }
           }`,
          { input: { id: profile.id } },
        );
      }
    }
  } catch {
    console.log('  (cleanup of data records was incomplete)');
  }

  for (const username of created.users) await deleteUser(username);
  // The supervisor account is created by the Lambda, so remove it by phone.
  await deleteUser(SUPERVISOR.phone);
  console.log('\n  test accounts removed');
}

console.log(r.state.failures === 0 ? '\nAll data-flow checks passed.\n' : `\n${r.state.failures} check(s) failed.\n`);
process.exit(r.state.failures === 0 ? 0 : 1);
