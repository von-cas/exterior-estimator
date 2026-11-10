# n8n workflows

Exported without credentials. Import both, then:

1. Create a **Header Auth** credential named `Estimator outbox` with header
   `x-outbox-secret` and the app's `OUTBOX_SECRET` as the value, and pick it on
   the three HTTP nodes.
2. Create a Gmail (or SMTP) credential and pick it on both email nodes.
3. In `Settings`, set `appUrl` and `orderEmailTo`; in the error workflow, set
   the alert address.
4. In the outbox workflow's settings, choose `Exterior estimator: error alert`
   as the error workflow. Activate both.

| Workflow | What it does |
|---|---|
| `outbox.json` | Every minute: claims events from the app, emails each approved purchase order, acknowledges the result. A failed send is acknowledged as failed, so the app retries it; after 5 attempts the app gives up and the workflow raises an error |
| `error-alert.json` | Emails an alert when any workflow fails, including a purchase order the outbox gave up on |

n8n never calculates anything. It only moves events the app has already
approved. Each purchase order carries a unique key in its subject and body, so
a supplier can spot a duplicate if a send is retried after a timeout.
