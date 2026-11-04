# Private sharing rollout

## Database

Review the live schema before applying changes. The expected legacy order is
`20261029_create_sharing_invites.sql`, `20261030_add_health_notifications.sql`,
`20261031_sharing_recipient_read.sql`, then
`20261104141237_private_sharing_consent.sql`. Some databases received the
legacy SQL under different migration history IDs. Verify the actual tables,
constraints, triggers, and policies before deciding which prerequisites are
missing. Apply the new migration once, then release the app that uses the new
RPCs. Old app builds need the update for Sharing after the cutover.

The migration retains old invitations. A former active or paused invitation
can be matched to the same confirmed account using its original inbox
delivery. Those invitations become pending because the old model had no
recipient consent. An unmatched, duplicate, or undeliverable row stays in
history as revoked. The sender can issue a new invitation. All legacy privacy
levels become specific. Past view-alert and digest options are disabled
because there is no supported delivery workflow for either.

Only invitation metadata and inbox notifications belong in the
`supabase_realtime` publication for this feature. The migration adds
`sharing_invites` and `app_notifications` if that publication exists and
removes the three raw health tables from it. A write to an enabled category
signals a refresh through its active invitations. Clients also recheck on
focus, reconnection and a foreground interval. The metrics RPC applies
permissions and the invitation version at read time. SQL roles never receive
raw cross-account profile, sleep, step or meal rows.
Keep the `sharing_private` schema outside the Data API's exposed schemas.
Public avatars from this project's avatar bucket can be displayed. Private
avatar files remain available through the owner's existing storage policy.

The inbox stores event kinds and invitation references. It does not store
metric values or copied profile details. Each real transition has a version,
so retries cannot duplicate a notification. Incoming invitation banners on a
device also depend on that device's existing notification permission.

## Local checks

Use a disposable PostgreSQL instance with logical WAL enabled. The fixture
creates representative legacy tables and uses `SET ROLE authenticated` and
the request JWT subject setting. It loads the three legacy migrations and the
new migration, then executes the authorization matrix with three separate
account IDs. The fixture refuses databases with other names.

```sh
createdb -h 127.0.0.1 -p 56439 -U postgres healthycheck_sharing_test
psql -h 127.0.0.1 -p 56439 -U postgres -d healthycheck_sharing_test -f supabase/tests/sharing_rls_fixture.sql
```

Use an empty test database on subsequent runs. On a separate Supabase
staging project, repeat the flow using actual signed-in clients. Verify
Realtime delivery, inbox read markers and links, account changes while a
request is in flight, and what Android/iOS display during offline recovery.
