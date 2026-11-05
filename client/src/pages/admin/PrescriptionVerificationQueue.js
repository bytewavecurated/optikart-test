import React from 'react';
import PrescriptionQueue from '../staff/PrescriptionQueue';

/**
 * Administrators supervise the same prescription queue the doc verifiers work
 * through - the server accepts either - but the staff layout is a workspace with
 * a sidebar of its own, so this gives admins the screen inside the admin shell
 * instead of sending them into another application.
 */
export default function PrescriptionVerificationQueue() {
  return (
    <div>
      <p style={{ margin: '0 0 14px', fontSize: 13.5, color: 'var(--text-secondary)', maxWidth: 760 }}>
        Every prescription customers have sent that is waiting for, or has had, a human check. Lenses are ground to
        these numbers, so a record cannot be skipped - a rejection needs a reason, and both decisions are written back
        to the customer&apos;s saved prescription.
      </p>
      <PrescriptionQueue />
    </div>
  );
}
