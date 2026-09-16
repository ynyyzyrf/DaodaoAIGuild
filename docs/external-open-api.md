# DaoStore External Open API

External APIs are separated from the browser/admin API surface under:

```text
/api/open/v1
```

Authentication:

```http
X-API-Key: <external-api-key>
```

## Create Order

```http
POST /api/open/v1/orders
```

Required scope:

```text
orders:write
```

Request body uses the same order intake shape as `DemandOrderCreate`:

```json
{
  "enterprise_name": "Globex",
  "contact_name": "Ada",
  "contact_email": "ada@example.com",
  "title": "Build an AI support workflow",
  "description": "Need a customer-service triage workflow.",
  "budget_amount": 20000
}
```

Behavior:

- The API key must be active, unexpired, and include `orders:write`.
- The order creator is the user bound to the API key.
- External orders are created and immediately submitted to `pending_review`.
- Successful calls write an `external_api_logs` entry.
- The response is intentionally external-facing and does not include PMDesktop,
  review, claim, or internal user fields. PMDesktop sync happens later after a
  consulting company claims the order and assigns an FDE.

Success response:

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": 123,
    "enterprise_name": "Globex",
    "contact_name": "Ada",
    "contact_email": "ada@example.com",
    "title": "Build an AI support workflow",
    "status": "pending_review",
    "next_step": "platform_review",
    "created_at": "2026-09-16T02:02:09.165Z"
  }
}
```

Common error codes:

| HTTP | code | Meaning |
|---|---:|---|
| 401 | 41021 | Missing API key |
| 401 | 41022 | Invalid API key |
| 401 | 41023 | Bound user is unavailable |
| 401 | 41024 | API key expired |
| 403 | 42021 | API key lacks the required scope |
