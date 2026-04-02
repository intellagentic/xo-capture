# Encryption Refactor: Remove DB Encryption, Keep S3-Only

## Summary

Remove all encrypt/decrypt calls on database fields across all lambdas. Retain encryption only for S3 objects (per-client key). Add an admin toggle (`s3_encryption_enabled`) in system_config to enable/disable S3 encryption with a bulk conversion modal showing per-client progress.

---

## Phase 1: Remove Database Field Encryption

### 1.1 Migration Script — Decrypt All DB Fields

**New file:** `backend/lambdas/shared/migrate_decrypt_db.py`

Connects to the database, reads every encrypted field, decrypts it, and writes it back as plaintext. Idempotent — skips fields that are already plaintext (decrypt() returns the original value on failure).

**Tables and fields to decrypt:**

| Table | Fields | Key Type |
|-------|--------|----------|
| users | email, name, google_drive_refresh_token | Master key |
| clients | contact_name, contact_title, contact_email, contact_phone, contact_linkedin, contacts_json, addresses_json, streamline_webhook_url | Client key |
| engagements | contacts_json | Client key |
| partners | email, phone, contacts_json, addresses_json | Master key |
| buttons | url | Master key |
| two_factor_codes | email (stored user context) | Master key |

**Steps:**
1. For each table, SELECT all rows
2. For each encrypted field, call `decrypt()` or `client_decrypt()` as appropriate
3. UPDATE the row with plaintext values
4. Log progress: `Decrypted {table}.{field} for {count} rows`

### 1.2 Lambda Code Changes — Remove encrypt/decrypt on DB Fields

#### `auth/lambda_function.py`
| Line(s) | Current | Change To |
|---------|---------|-----------|
| ~349 | `encrypt(user_context)` stored in two_factor_codes.email | Store plaintext `user_context` |
| ~481 | `decrypt(encrypted_context)` from two_factor_codes | Read plaintext directly |
| ~518 | `encrypt(email)`, `encrypt(name)` on INSERT into users | Store plaintext email, name |
| ~881 | `decrypt(user_row[1])`, `decrypt(user_row[2])` | Read plaintext directly |
| ~930 | `decrypt_json(contacts_raw)` | `json.loads(contacts_raw)` directly |
| ~1004-1006 | `decrypt(row[1])`, `decrypt(row[3])` | Read plaintext directly |
| ~1044 | `encrypt(email)`, `encrypt(name)` on INSERT | Store plaintext |
| ~1106 | `encrypt(email)`, `encrypt(name)` on INSERT | Store plaintext |

**Also remove:** `search_hash()` usage and `email_hash` column — no longer needed since emails are plaintext and searchable directly.

#### `clients/lambda_function.py`
| Line(s) | Current | Change To |
|---------|---------|-----------|
| ~354-356 | `client_decrypt(ck, row[N])` for contact_name, contact_title, contact_linkedin | Read plaintext directly |
| ~363-364 | `client_decrypt(ck, row[N])` for contact_email, contact_phone | Read plaintext directly |
| ~371 | `client_decrypt_json(ck, contacts_json_raw)` | `json.loads(contacts_json_raw)` |
| ~387 | `client_decrypt_json(ck, addresses_json_raw)` | `json.loads(addresses_json_raw)` |
| ~396 | `client_decrypt_json(ck, engagement_contacts_raw)` | `json.loads(engagement_contacts_raw)` |
| ~405 | `client_decrypt(ck, row[15])` for streamline_webhook_url | Read plaintext directly |
| All INSERTs/UPDATEs | `client_encrypt(ck, value)` for contact fields | Store plaintext |
| All INSERTs/UPDATEs | `client_encrypt_json(ck, obj)` for JSON fields | `json.dumps(obj)` |

**Keep:** `generate_client_key()` on client create and `unwrap_client_key()` — still needed for S3 encryption.

#### `buttons/lambda_function.py`
| Line(s) | Current | Change To |
|---------|---------|-----------|
| ~144 | `decrypt(row[4])` for buttons.url | Read plaintext directly |
| ~199, 219, 238 | `encrypt(btn.get('url', ''))` | Store plaintext URL |

#### `gdrive/lambda_function.py`
| Line(s) | Current | Change To |
|---------|---------|-----------|
| ~166 | `encrypt(credentials.refresh_token)` | Store plaintext |
| ~212, 311 | `decrypt(row[0])` / `decrypt(token_row[0])` | Read plaintext directly |

**Keep:** S3 encryption calls (`encrypt_s3_bytes`) — controlled by the new toggle.

#### `enrich/lambda_function.py`
| Line(s) | Current | Change To |
|---------|---------|-----------|
| ~354-405 | All `client_decrypt()` / `client_decrypt_json()` calls on client DB fields | Read plaintext directly |

**Keep:** S3 decrypt/encrypt calls (`decrypt_s3_body`, `encrypt_s3_body`) — controlled by the new toggle.

#### `results/lambda_function.py`
| Line(s) | Current | Change To |
|---------|---------|-----------|
| ~158-164 | `client_decrypt(ck, crow[N])` for company_name, industry, description, contact_name, contact_email, contacts_json | Read plaintext directly |

**Keep:** S3 decrypt call (`decrypt_s3_body`) — controlled by the new toggle.

#### `rapid-prototype/lambda_function.py`
**Keep:** S3 decrypt call (`decrypt_s3_body`) — controlled by the new toggle.

### 1.3 crypto_helper.py Changes

**Keep ALL existing functions** — they remain available for future use. No functions are removed.

**Add new functions** for S3 toggle support:
- `is_s3_encryption_enabled(cursor)` — reads system_config toggle
- `maybe_encrypt_s3_body/bytes()` — conditional wrappers
- `maybe_decrypt_s3_body/bytes()` — conditional wrappers

### 1.4 Schema Change

```sql
-- Remove email_hash column (no longer needed for lookups)
ALTER TABLE users DROP COLUMN IF EXISTS email_hash;
```

---

## Phase 2: Admin Toggle for S3 Encryption

### 2.1 system_config Entry

**Key:** `s3_encryption_enabled`
**Values:** `'true'` or `'false'` (default: `'true'` — current behavior)

### 2.2 Backend: Read the Toggle in Each Lambda

Every lambda that reads/writes S3 must check the toggle before encrypting/decrypting.

**Add helper to crypto_helper.py:**

```python
def is_s3_encryption_enabled(cursor):
    """Check system_config for s3_encryption_enabled. Defaults to True."""
    try:
        cursor.execute(
            "SELECT config_value FROM system_config WHERE config_key = 's3_encryption_enabled'"
        )
        row = cursor.fetchone()
        return row is None or row[0].lower() != 'false'
    except:
        return True
```

**Modify S3 functions to be conditional:**

```python
def maybe_encrypt_s3_body(key, body, enabled=True):
    """Encrypt only if enabled; otherwise store plaintext."""
    return encrypt_s3_body(key, body) if enabled else body

def maybe_decrypt_s3_body(key, body, enabled=True):
    """Decrypt if body has ENC: prefix; otherwise return as-is."""
    # decrypt_s3_body already handles plaintext fallback via the ENC: prefix check
    return decrypt_s3_body(key, body) if enabled else body

def maybe_encrypt_s3_bytes(key, data, enabled=True):
    return encrypt_s3_bytes(key, data) if enabled else data

def maybe_decrypt_s3_bytes(key, data, enabled=True):
    return decrypt_s3_bytes(key, data) if enabled else data
```

> **Note:** `decrypt_s3_body` and `decrypt_s3_bytes` already detect the `ENC:`/`ENCB:` prefix. So even when the toggle is off, reading previously-encrypted files will still work correctly because the prefix check handles both cases. The `maybe_*` wrappers are a clarity layer — the critical change is the write path.

**Lambda changes (all S3-touching lambdas):**

```python
# At the start of each handler, after DB connection:
s3_enc = is_s3_encryption_enabled(cursor)

# Then pass it through:
body = maybe_encrypt_s3_body(ck, content, enabled=s3_enc)
raw = maybe_decrypt_s3_body(ck, raw, enabled=s3_enc)
```

Affected lambdas: `clients`, `enrich`, `results`, `rapid-prototype`, `gdrive`

### 2.3 Backend: Bulk S3 Conversion Endpoint

**New endpoint:** `POST /system-config/s3-encryption-convert`
**Admin only.** Accepts `{ "action": "encrypt" | "decrypt" }`.

Returns Server-Sent Events (SSE) stream for real-time progress:

```python
def handle_s3_encryption_convert(event, cursor, conn, user):
    """Bulk encrypt or decrypt all S3 files for all clients. Streams progress via SSE."""
    body = json.loads(event.get('body', '{}'))
    action = body.get('action')  # 'encrypt' or 'decrypt'

    if action not in ('encrypt', 'decrypt'):
        return {'statusCode': 400, 'body': json.dumps({'error': 'action must be encrypt or decrypt'})}

    # Get all clients with encryption keys
    cursor.execute("SELECT id, company_name, encryption_key FROM clients WHERE deleted_at IS NULL")
    clients = cursor.fetchall()
    total = len(clients)
    results = []

    for idx, (client_id, company_name, enc_key_raw) in enumerate(clients):
        client_result = {
            'client_id': client_id,
            'company_name': company_name,
            'status': 'processing',
            'files_converted': 0,
            'errors': []
        }

        try:
            ck = unwrap_client_key(enc_key_raw) if enc_key_raw else None
            if not ck:
                client_result['status'] = 'skipped'
                client_result['reason'] = 'no encryption key'
                results.append(client_result)
                continue

            # List all S3 objects for this client
            s3 = boto3.client('s3')
            bucket = os.environ.get('S3_BUCKET', 'xo-client-data')
            prefix = f"{client_id}/"
            paginator = s3.get_paginator('list_objects_v2')
            files_converted = 0

            for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
                for obj in page.get('Contents', []):
                    key = obj['Key']
                    try:
                        response = s3.get_object(Bucket=bucket, Key=key)
                        raw = response['Body'].read()
                        content_type = response.get('ContentType', '')

                        if action == 'decrypt':
                            # Text files with ENC: prefix
                            body_str = raw.decode('utf-8', errors='ignore')
                            if body_str.startswith('ENC:'):
                                decrypted = decrypt_s3_body(ck, body_str)
                                s3.put_object(Bucket=bucket, Key=key, Body=decrypted.encode('utf-8'))
                                files_converted += 1
                            # Binary files with ENCB: prefix
                            elif raw[:5] == b'ENCB:':
                                decrypted = decrypt_s3_bytes(ck, raw)
                                s3.put_object(Bucket=bucket, Key=key, Body=decrypted)
                                files_converted += 1
                            # else: already plaintext, skip

                        elif action == 'encrypt':
                            body_str = raw.decode('utf-8', errors='ignore')
                            if not body_str.startswith('ENC:') and raw[:5] != b'ENCB:':
                                # Determine text vs binary
                                is_text = key.endswith(('.md', '.json', '.txt', '.csv'))
                                if is_text:
                                    encrypted = encrypt_s3_body(ck, body_str)
                                    s3.put_object(Bucket=bucket, Key=key, Body=encrypted.encode('utf-8'))
                                else:
                                    encrypted = encrypt_s3_bytes(ck, raw)
                                    s3.put_object(Bucket=bucket, Key=key, Body=encrypted)
                                files_converted += 1
                            # else: already encrypted, skip

                    except Exception as e:
                        client_result['errors'].append(f"{key}: {str(e)}")

            client_result['files_converted'] = files_converted
            client_result['status'] = 'done'

        except Exception as e:
            client_result['status'] = 'error'
            client_result['errors'].append(str(e))

        results.append(client_result)

    # Update the toggle
    new_value = 'true' if action == 'encrypt' else 'false'
    cursor.execute("""
        INSERT INTO system_config (config_key, config_value, updated_at)
        VALUES ('s3_encryption_enabled', %s, NOW())
        ON CONFLICT (config_key) DO UPDATE SET config_value = %s, updated_at = NOW()
    """, (new_value, new_value))
    conn.commit()

    return {
        'statusCode': 200,
        'body': json.dumps({
            'action': action,
            'total_clients': total,
            'results': results,
            's3_encryption_enabled': new_value == 'true'
        })
    }
```

> **Lambda timeout note:** This endpoint could take minutes for many clients with many files. If the total S3 object count is large, consider processing via SQS/Step Functions instead. For <50 clients, a single Lambda invocation with 5-minute timeout should suffice.

### 2.4 API Gateway Route

```
POST /system-config/s3-encryption-convert → clients lambda (or dedicated lambda)
```

Add to the route dispatcher in `clients/lambda_function.py`:

```python
elif path == '/system-config/s3-encryption-convert' and method == 'POST':
    return handle_s3_encryption_convert(event, cursor, conn, user)
```

---

## Phase 3: Frontend — Admin Toggle + Progress Modal

### 3.1 New State Variables (in App.jsx)

```javascript
const [sysS3EncEnabled, setSysS3EncEnabled] = useState(true)
const [s3ConvertModal, setS3ConvertModal] = useState(false)
const [s3ConvertAction, setS3ConvertAction] = useState(null)       // 'encrypt' | 'decrypt'
const [s3ConvertProgress, setS3ConvertProgress] = useState(null)   // { total, completed, results: [] }
const [s3ConvertRunning, setS3ConvertRunning] = useState(false)
```

### 3.2 Load Toggle on Admin Dashboard

Add to the existing `loadSystemConfig` (where `sysInviteUrl` etc. are loaded):

```javascript
setSysS3EncEnabled(config['s3_encryption_enabled'] !== 'false')
```

### 3.3 UI: Toggle + Convert Button

Add below the existing "Send to Streamline" toggle in the System Configuration panel:

```jsx
{/* S3 Encryption Toggle */}
<div style={{
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  marginTop: '0.75rem', padding: '1rem',
  background: C.surface, borderRadius: 10, border: `1px solid ${C.border}`
}}>
  <div style={{ flex: 1, marginRight: '1rem' }}>
    <span style={{ fontSize: '0.9rem', fontWeight: 500, color: C.text }}>
      S3 File Encryption
    </span>
    <p style={{ fontSize: '0.75rem', color: C.muted, marginTop: 4, lineHeight: 1.4 }}>
      Encrypt all client files stored in S3 (skills, configs, results, uploads).
      Toggling this will convert all existing files.
    </p>
  </div>
  <button
    onClick={() => {
      setS3ConvertAction(sysS3EncEnabled ? 'decrypt' : 'encrypt')
      setS3ConvertModal(true)
    }}
    style={{
      width: 52, height: 28, borderRadius: 14, border: 'none',
      background: sysS3EncEnabled ? '#dc2626' : '#e5e5e5',
      position: 'relative', cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0
    }}
  >
    <div style={{
      width: 22, height: 22, borderRadius: '50%', background: 'white',
      position: 'absolute', top: 3, left: sysS3EncEnabled ? 27 : 3,
      transition: 'all 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
    }} />
  </button>
</div>
```

### 3.4 UI: Confirmation + Progress Modal

```jsx
{s3ConvertModal && (
  <div className="overlay" onClick={() => !s3ConvertRunning && setS3ConvertModal(false)}>
    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
      <div className="modal-header">
        <h2>{s3ConvertAction === 'encrypt' ? 'Encrypt' : 'Decrypt'} All S3 Files</h2>
        {!s3ConvertRunning && (
          <button className="close-btn" onClick={() => setS3ConvertModal(false)}>
            <X size={18} />
          </button>
        )}
      </div>
      <div className="modal-body" style={{ padding: '1.25rem' }}>

        {/* Pre-run confirmation */}
        {!s3ConvertRunning && !s3ConvertProgress && (
          <>
            <p style={{ fontSize: '0.85rem', color: C.text, lineHeight: 1.5 }}>
              This will <strong>{s3ConvertAction}</strong> all S3 files for every client.
              {s3ConvertAction === 'decrypt'
                ? ' Files will be stored as plaintext. This is reversible.'
                : ' Files will be encrypted with each client\'s key.'}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setS3ConvertModal(false)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={runS3Convert}>
                {s3ConvertAction === 'encrypt' ? 'Encrypt All' : 'Decrypt All'}
              </button>
            </div>
          </>
        )}

        {/* Running — progress display */}
        {s3ConvertRunning && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: '0.85rem', color: C.text }}>
                Converting... {s3ConvertProgress?.completed || 0} / {s3ConvertProgress?.total || '?'} clients
              </span>
            </div>
            {/* Progress bar */}
            <div style={{
              width: '100%', height: 6, background: `${C.muted}30`,
              borderRadius: 3, overflow: 'hidden', marginBottom: '1rem'
            }}>
              <div style={{
                width: `${s3ConvertProgress?.total
                  ? (s3ConvertProgress.completed / s3ConvertProgress.total * 100)
                  : 0}%`,
                height: '100%', background: '#dc2626', borderRadius: 3,
                transition: 'width 0.3s'
              }} />
            </div>
            {/* Per-client log */}
            <div style={{
              maxHeight: 250, overflowY: 'auto', fontSize: '0.75rem',
              fontFamily: 'monospace', background: C.bg, borderRadius: 6,
              padding: '0.75rem', border: `1px solid ${C.border}`
            }}>
              {(s3ConvertProgress?.results || []).map((r, i) => (
                <div key={i} style={{
                  padding: '0.25rem 0',
                  borderBottom: `1px solid ${C.border}`,
                  color: r.status === 'error' ? '#ef4444'
                       : r.status === 'skipped' ? C.muted
                       : '#22c55e'
                }}>
                  {r.status === 'done' && '✓'}
                  {r.status === 'error' && '✗'}
                  {r.status === 'skipped' && '–'}
                  {' '}{r.company_name} — {r.files_converted} files
                  {r.status === 'skipped' && ` (${r.reason})`}
                  {r.errors?.length > 0 && ` [${r.errors.length} errors]`}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Completed */}
        {!s3ConvertRunning && s3ConvertProgress && (
          <>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              marginBottom: '1rem', color: '#22c55e'
            }}>
              <CheckCircle2 size={20} />
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                Conversion complete
              </span>
            </div>
            <p style={{ fontSize: '0.8rem', color: C.muted, marginBottom: '1rem' }}>
              {s3ConvertProgress.completed} / {s3ConvertProgress.total} clients processed.
              S3 encryption is now <strong>{s3ConvertAction === 'encrypt' ? 'enabled' : 'disabled'}</strong>.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn-primary" onClick={() => {
                setS3ConvertModal(false)
                setS3ConvertProgress(null)
                setSysS3EncEnabled(s3ConvertAction === 'encrypt')
              }}>
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  </div>
)}
```

### 3.5 Conversion Function

```javascript
const runS3Convert = async () => {
  setS3ConvertRunning(true)
  setS3ConvertProgress({ total: 0, completed: 0, results: [] })

  try {
    const res = await fetch(`${API_BASE}/system-config/s3-encryption-convert`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ action: s3ConvertAction })
    })
    const data = await res.json()

    // Simulate progressive display by revealing results one at a time
    const results = data.results || []
    for (let i = 0; i < results.length; i++) {
      await new Promise(r => setTimeout(r, 150))  // visual pacing
      setS3ConvertProgress({
        total: data.total_clients,
        completed: i + 1,
        results: results.slice(0, i + 1)
      })
    }

    setSysS3EncEnabled(data.s3_encryption_enabled)
  } catch (err) {
    console.error('S3 conversion failed:', err)
  }

  setS3ConvertRunning(false)
}
```

---

## Phase 4: Deployment Plan

### Step 1: Run DB Decryption Migration
```bash
python backend/lambdas/shared/migrate_decrypt_db.py
```
This decrypts all DB fields in-place. Idempotent — safe to re-run.

### Step 2: Deploy Updated Lambdas
All lambdas with encrypt/decrypt calls on DB fields removed. S3 calls now check `s3_encryption_enabled` toggle.

### Step 3: Set Initial Toggle Value
```sql
INSERT INTO system_config (config_key, config_value)
VALUES ('s3_encryption_enabled', 'true')
ON CONFLICT (config_key) DO NOTHING;
```

### Step 4: Deploy Frontend
Updated admin panel with S3 Encryption toggle and conversion modal.

### Step 5: Drop email_hash Column
```sql
ALTER TABLE users DROP COLUMN IF EXISTS email_hash;
```

### Step 6: (Optional) Remove AES_MASTER_KEY
Master key is no longer needed for DB operations. Only needed if S3 encryption is enabled (to unwrap client keys). Can remove from Lambda env if S3 encryption is permanently disabled.

---

## Files Changed Summary

| File | Change |
|------|--------|
| `shared/crypto_helper.py` | Remove DB encrypt/decrypt functions. Add `is_s3_encryption_enabled()`, `maybe_encrypt_s3_*`, `maybe_decrypt_s3_*` |
| `shared/migrate_decrypt_db.py` | **New.** One-time script to decrypt all DB fields |
| `auth/lambda_function.py` | Remove all encrypt/decrypt/search_hash calls (~8 locations) |
| `clients/lambda_function.py` | Remove DB encrypt/decrypt (~12 locations). Add S3 toggle check. Add conversion endpoint |
| `buttons/lambda_function.py` | Remove encrypt/decrypt (~4 locations) |
| `gdrive/lambda_function.py` | Remove DB encrypt/decrypt (~3 locations). Add S3 toggle check |
| `enrich/lambda_function.py` | Remove DB decrypt (~8 locations). Add S3 toggle check |
| `results/lambda_function.py` | Remove DB decrypt (~6 locations). Add S3 toggle check |
| `rapid-prototype/lambda_function.py` | Add S3 toggle check |
| `src/App.jsx` | Add S3 Encryption toggle + conversion modal in admin System Configuration |
| `backend/schema.sql` | Drop `email_hash` column from users |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Data loss during DB decryption migration | Migration is idempotent; `decrypt()` returns original on failure. Take DB snapshot first. |
| Lambda timeout on bulk S3 conversion | Set Lambda timeout to 5 min. For >50 clients, consider chunked processing or Step Functions. |
| Mixed state during conversion | `decrypt_s3_body` already handles both encrypted and plaintext via `ENC:` prefix detection — reads always work regardless of toggle state. |
| Admin accidentally disables encryption | Confirmation modal with explicit action required. Toggle shows current state clearly. |
