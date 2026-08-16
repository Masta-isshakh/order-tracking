import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { userManager } from '../functions/user-manager/resource';
import { submitBooking } from '../functions/submit-booking/resource';
import { smsRegistry } from '../functions/sms-registry/resource';

/**
 * Result shape returned by every Lambda-backed mutation. `ok:false` always comes
 * with a machine-readable `code` so the app can localise the message itself.
 */
const staffResult = a.customType({
  ok: a.boolean().required(),
  code: a.string(),
  message: a.string(),
  userId: a.string(),
  phone: a.string(),
  orderId: a.string(),
  orderNumber: a.string(),
});

/** Registry snapshot returned alongside every SMS-number operation. */
const smsRegistryResult = a.customType({
  ok: a.boolean().required(),
  code: a.string(),
  message: a.string(),
  /** JSON: `{ inSandbox: boolean, numbers: [{ phone, status }] }`. */
  data: a.string(),
});

const schema = a
  .schema({
    StaffResult: staffResult,
    SmsRegistryResult: smsRegistryResult,

    /* ------------------------------------------------------------------ *
     * Catalog — readable by everyone (the Book a Service tab is public),
     * writable only by staff.
     * ------------------------------------------------------------------ */
    Service: a
      .model({
        name: a.string().required(),
        nameAr: a.string(),
        description: a.string(),
        descriptionAr: a.string(),
        price: a.float(),
        currency: a.string(),
        imageKey: a.string(),
        galleryKeys: a.string().array(),
        category: a.string(),
        durationMinutes: a.integer(),
        isActive: a.boolean().default(true),
        sortOrder: a.integer().default(0),
        /** StepTemplate[] — the roadmap every order for this service inherits. */
        steps: a.json(),
        createdBySub: a.string(),
        createdByName: a.string(),
      })
      .authorization((allow) => [
        allow.guest().to(['read']),
        allow.authenticated().to(['read']),
        allow.groups(['ADMIN', 'SUPERVISOR']),
      ]),

    Package: a
      .model({
        name: a.string().required(),
        nameAr: a.string(),
        description: a.string(),
        descriptionAr: a.string(),
        price: a.float(),
        currency: a.string(),
        imageKey: a.string(),
        galleryKeys: a.string().array(),
        durationMinutes: a.integer(),
        includedServiceIds: a.string().array(),
        isActive: a.boolean().default(true),
        sortOrder: a.integer().default(0),
        steps: a.json(),
        createdBySub: a.string(),
        createdByName: a.string(),
      })
      .authorization((allow) => [
        allow.guest().to(['read']),
        allow.authenticated().to(['read']),
        allow.groups(['ADMIN', 'SUPERVISOR']),
      ]),

    /* ------------------------------------------------------------------ *
     * People
     * ------------------------------------------------------------------ */
    CustomerProfile: a
      .model({
        phone: a.string().required(),
        name: a.string().required(),
        email: a.string(),
        notes: a.string(),
        isActive: a.boolean().default(true),
        /** Cognito `sub` — lets the customer read their own profile row. */
        ownerSub: a.string(),
        cognitoUsername: a.string(),
        orderCount: a.integer().default(0),
        createdBySub: a.string(),
        createdByName: a.string(),
      })
      .secondaryIndexes((index) => [index('phone')])
      .authorization((allow) => [
        allow.groups(['ADMIN', 'SUPERVISOR']),
        allow.ownerDefinedIn('ownerSub').identityClaim('sub').to(['read']),
      ]),

    /** Staff directory. Holds both supervisors and administrators. */
    SupervisorProfile: a
      .model({
        phone: a.string().required(),
        name: a.string().required(),
        email: a.string(),
        description: a.string(),
        /** Role — 'SUPERVISOR' (default) or 'ADMIN'. Mirrors the Cognito group. */
        role: a.string(),
        isActive: a.boolean().default(true),
        ownerSub: a.string(),
        cognitoUsername: a.string(),
        createdBySub: a.string(),
        createdByName: a.string(),
      })
      .secondaryIndexes((index) => [index('phone')])
      .authorization((allow) => [
        allow.group('ADMIN'),
        allow.group('SUPERVISOR').to(['read']),
      ]),

    /* ------------------------------------------------------------------ *
     * Orders
     *
     * `customerOwner` holds the customer's Cognito `sub`. It is what lets a
     * customer read their own order (and only their own) without any extra
     * filtering in the app. Staff reach every order through group rules.
     * ------------------------------------------------------------------ */
    Order: a
      .model({
        orderNumber: a.string().required(),
        /** OrderStatus */
        status: a.string().required(),
        /** OrderSource */
        source: a.string().required(),
        createdAtIso: a.string().required(),

        customerOwner: a.string(),
        customerProfileId: a.id(),
        customerName: a.string().required(),
        customerPhone: a.string().required(),
        customerEmail: a.string(),

        vehicleMake: a.string(),
        vehicleModel: a.string(),
        vehicleYear: a.string(),
        vehiclePlate: a.string(),
        vehicleColor: a.string(),
        vehicleVin: a.string(),
        vehicleImageKeys: a.string().array(),

        /** OrderItemSnapshot[] — prices frozen at the moment of ordering. */
        items: a.json(),
        totalAmount: a.float(),
        currency: a.string(),
        notes: a.string(),

        currentStepOrder: a.integer().default(0),
        totalStepCount: a.integer().default(0),
        completedStepCount: a.integer().default(0),

        holdReason: a.string(),
        holdAt: a.datetime(),
        cancelReason: a.string(),

        assignedSupervisorSub: a.string(),
        assignedSupervisorName: a.string(),
        assignedSupervisorPhone: a.string(),

        createdBySub: a.string(),
        createdByName: a.string(),
        createdByRole: a.string(),

        scheduledAt: a.datetime(),
        startedAt: a.datetime(),
        completedAt: a.datetime(),

        unreadForCustomer: a.integer().default(0),
        unreadForStaff: a.integer().default(0),

        steps: a.hasMany('OrderStep', 'orderId'),
        messages: a.hasMany('ChatMessage', 'orderId'),
      })
      .secondaryIndexes((index) => [
        index('status').sortKeys(['createdAtIso']).queryField('ordersByStatus'),
        index('customerOwner').sortKeys(['createdAtIso']).queryField('ordersByCustomerOwner'),
        index('customerPhone').sortKeys(['createdAtIso']).queryField('ordersByCustomerPhone'),
        index('orderNumber').queryField('ordersByNumber'),
      ])
      .authorization((allow) => [
        allow.groups(['ADMIN', 'SUPERVISOR']),
        allow.ownerDefinedIn('customerOwner').identityClaim('sub').to(['read']),
      ]),

    /* One node of the tracking roadmap. */
    OrderStep: a
      .model({
        orderId: a.id().required(),
        order: a.belongsTo('Order', 'orderId'),
        /** Denormalised from the parent so row-level customer reads work here too. */
        customerOwner: a.string(),

        sortOrder: a.integer().required(),
        name: a.string().required(),
        nameAr: a.string(),
        description: a.string(),

        /** CatalogKind */
        sourceKind: a.string(),
        sourceId: a.string(),
        sourceName: a.string(),

        /** StepStatus */
        status: a.string().required(),
        imageKeys: a.string().array(),
        note: a.string(),

        startedAt: a.datetime(),
        completedAt: a.datetime(),
        completedBySub: a.string(),
        completedByName: a.string(),
      })
      .secondaryIndexes((index) => [
        index('orderId').sortKeys(['sortOrder']).queryField('stepsByOrder'),
      ])
      .authorization((allow) => [
        allow.groups(['ADMIN', 'SUPERVISOR']),
        allow.ownerDefinedIn('customerOwner').identityClaim('sub').to(['read']),
      ]),

    /* Order-scoped chat between the customer and staff. */
    ChatMessage: a
      .model({
        orderId: a.id().required(),
        order: a.belongsTo('Order', 'orderId'),
        customerOwner: a.string(),
        createdAtIso: a.string().required(),

        senderSub: a.string(),
        senderName: a.string(),
        /** Role */
        senderRole: a.string().required(),

        body: a.string(),
        imageKey: a.string(),
        readByCustomer: a.boolean().default(false),
        readByStaff: a.boolean().default(false),
      })
      .secondaryIndexes((index) => [
        index('orderId').sortKeys(['createdAtIso']).queryField('messagesByOrder'),
      ])
      .authorization((allow) => [
        allow.groups(['ADMIN', 'SUPERVISOR']),
        allow.ownerDefinedIn('customerOwner').identityClaim('sub').to(['read', 'create', 'update']),
      ]),

    /* ------------------------------------------------------------------ *
     * Company profile shown on the public home tab. Single row, id "GLOBAL".
     * ------------------------------------------------------------------ */
    AppSettings: a
      .model({
        companyName: a.string(),
        companyNameAr: a.string(),
        tagline: a.string(),
        taglineAr: a.string(),
        about: a.string(),
        aboutAr: a.string(),
        phone: a.string(),
        whatsapp: a.string(),
        email: a.string(),
        address: a.string(),
        addressAr: a.string(),
        mapUrl: a.string(),
        heroImageKeys: a.string().array(),
        workingHours: a.json(),
        socialLinks: a.json(),
        currency: a.string(),
      })
      .authorization((allow) => [
        allow.guest().to(['read']),
        allow.authenticated().to(['read']),
        allow.group('ADMIN'),
      ]),

    /* ------------------------------------------------------------------ *
     * Lambda-backed mutations. Anything that touches Cognito lives here so
     * the app never needs admin credentials.
     * ------------------------------------------------------------------ */
    createSupervisor: a
      .mutation()
      .arguments({
        name: a.string().required(),
        phone: a.string().required(),
        email: a.string(),
        description: a.string(),
      })
      .returns(a.ref('StaffResult'))
      .authorization((allow) => [allow.group('ADMIN')])
      .handler(a.handler.function(userManager)),

    /** Creates another administrator. Admin-only, by design. */
    createAdministrator: a
      .mutation()
      .arguments({
        name: a.string().required(),
        phone: a.string().required(),
        email: a.string(),
        description: a.string(),
      })
      .returns(a.ref('StaffResult'))
      .authorization((allow) => [allow.group('ADMIN')])
      .handler(a.handler.function(userManager)),

    updateSupervisorAccess: a
      .mutation()
      .arguments({ supervisorId: a.id().required(), isActive: a.boolean().required() })
      .returns(a.ref('StaffResult'))
      .authorization((allow) => [allow.group('ADMIN')])
      .handler(a.handler.function(userManager)),

    deleteSupervisor: a
      .mutation()
      .arguments({ supervisorId: a.id().required() })
      .returns(a.ref('StaffResult'))
      .authorization((allow) => [allow.group('ADMIN')])
      .handler(a.handler.function(userManager)),

    /** Called by staff while creating an order, so the customer can sign in. */
    ensureCustomerAccount: a
      .mutation()
      .arguments({
        name: a.string().required(),
        phone: a.string().required(),
        email: a.string(),
      })
      .returns(a.ref('StaffResult'))
      .authorization((allow) => [allow.groups(['ADMIN', 'SUPERVISOR'])])
      .handler(a.handler.function(userManager)),

    /* ------------------------------------------------------------------ *
     * SMS destination registry (admin only).
     *
     * While the AWS account is in the SMS sandbox, SNS only delivers to
     * numbers registered and confirmed at the account level. These let the
     * admin manage that list from the app instead of the AWS console.
     * ------------------------------------------------------------------ */
    listSmsNumbers: a
      .query()
      .returns(a.ref('SmsRegistryResult'))
      .authorization((allow) => [allow.group('ADMIN')])
      .handler(a.handler.function(smsRegistry)),

    registerSmsNumber: a
      .mutation()
      .arguments({ phone: a.string().required() })
      .returns(a.ref('SmsRegistryResult'))
      .authorization((allow) => [allow.group('ADMIN')])
      .handler(a.handler.function(smsRegistry)),

    confirmSmsNumber: a
      .mutation()
      .arguments({ phone: a.string().required(), code: a.string().required() })
      .returns(a.ref('SmsRegistryResult'))
      .authorization((allow) => [allow.group('ADMIN')])
      .handler(a.handler.function(smsRegistry)),

    removeSmsNumber: a
      .mutation()
      .arguments({ phone: a.string().required() })
      .returns(a.ref('SmsRegistryResult'))
      .authorization((allow) => [allow.group('ADMIN')])
      .handler(a.handler.function(smsRegistry)),

    /** Public "Book a Service" submission — no sign-in required. */
    submitPublicBooking: a
      .mutation()
      .arguments({
        name: a.string().required(),
        phone: a.string().required(),
        email: a.string(),
        notes: a.string(),
        preferredDate: a.string(),
        vehicleMake: a.string(),
        vehicleModel: a.string(),
        vehiclePlate: a.string(),
        /** JSON array of { kind, refId } chosen from the public catalog. */
        selections: a.json().required(),
      })
      .returns(a.ref('StaffResult'))
      .authorization((allow) => [allow.guest(), allow.authenticated()])
      .handler(a.handler.function(submitBooking)),
  })
  .authorization((allow) => [
    allow.resource(userManager),
    allow.resource(submitBooking),
    allow.resource(smsRegistry),
  ]);

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    // Staff and customers use their Cognito tokens. Guests reach the public
    // catalog and the booking mutation through the identity pool's
    // unauthenticated role, which `allow.guest()` wires up automatically.
    defaultAuthorizationMode: 'userPool',
  },
});
