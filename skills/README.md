# Skills

## Structure

### system/
System skills injected into every enrichment call. Source of truth is in git -- deploy to S3 with:

```bash
aws s3 sync ~/xo-quickstart/skills/system/ s3://xo-client-data-mv/_system/skills/ --profile intellagentic --region eu-west-2
```

These are also seeded into the `skills` DB table (with `client_id IS NULL`) by the clients Lambda migration.

### client-template/
Default skill template copied to each new client's S3 folder on creation. Reference only -- the actual template is in `backend/lambdas/clients/lambda_function.py` (`DEFAULT_SKILL_TEMPLATE`).

### Client skills (not in git)
Per-client skills live in S3 at `{client_id}/skills/` and are tracked in the `skills` DB table with a `client_id` foreign key. They are not tracked in git.
