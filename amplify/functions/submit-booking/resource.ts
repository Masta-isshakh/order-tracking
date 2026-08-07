import { defineFunction } from '@aws-amplify/backend';

/**
 * Handles the public "Book a Service" form.
 *
 * It provisions a CUSTOMER account for the phone number given, then writes the
 * order and its roadmap steps, so the person can sign in and track the job
 * straight away without any staff action.
 */
export const submitBooking = defineFunction({
  name: 'submit-booking',
  entry: './handler.ts',
  runtime: 20,
  timeoutSeconds: 30,
  environment: {
    DEFAULT_DIAL_CODE: '974',
    DEFAULT_CURRENCY: 'QAR',
    MAX_BOOKINGS_PER_PHONE_PER_DAY: '5',
  },
});
