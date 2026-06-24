# EFAR - Pre-signed Dev JWT Tokens

Use these tokens to test any protected endpoint during local development without going through the login flow.

**Dev secret:** `dev-secret-efar`  
**Algorithm:** HS256  
**Expires:** 90 days from issue (2026-09-23)  
**ENV variable:** `DEV_JWT_SECRET=dev-secret-efar` in `backend/.env`

> These tokens are only valid when `NODE_ENV` is NOT `production`. In production the server uses `JWT_SECRET` from `.env`.

---

## How to use

Add the token as a `Bearer` header in any HTTP client:

```
Authorization: Bearer <token>
```

Or in curl:

```bash
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/...
```

---

## Tokens

### managing_director

**Payload**
```json
{
  "sub": 1,
  "name": "Test Managing Director",
  "email": "md@efar.sg",
  "role": "managing_director"
}
```

**Token**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsIm5hbWUiOiJUZXN0IE1hbmFnaW5nIERpcmVjdG9yIiwiZW1haWwiOiJtZEBlZmFyLnNnIiwicm9sZSI6Im1hbmFnaW5nX2RpcmVjdG9yIiwiaWF0IjoxNzgyMzE3MTcyLCJleHAiOjE3OTAwOTMxNzJ9.DI2oc-ZAcNZW1i34h1MREdBvuaKx1KehSYKF19V9XD0
```

---

### ar_specialist

**Payload**
```json
{
  "sub": 2,
  "name": "Test AR Specialist",
  "email": "ar@efar.sg",
  "role": "ar_specialist"
}
```

**Token**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjIsIm5hbWUiOiJUZXN0IEFSIFNwZWNpYWxpc3QiLCJlbWFpbCI6ImFyQGVmYXIuc2ciLCJyb2xlIjoiYXJfc3BlY2lhbGlzdCIsImlhdCI6MTc4MjMxNzE3MiwiZXhwIjoxNzkwMDkzMTcyfQ.gJXX9E-bownPxHtbJS2Wx5-bQyFq6Xpw7TvgEcMuo7o
```

---

### ap_specialist

**Payload**
```json
{
  "sub": 3,
  "name": "Test AP Specialist",
  "email": "ap@efar.sg",
  "role": "ap_specialist"
}
```

**Token**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjMsIm5hbWUiOiJUZXN0IEFQIFNwZWNpYWxpc3QiLCJlbWFpbCI6ImFwQGVmYXIuc2ciLCJyb2xlIjoiYXBfc3BlY2lhbGlzdCIsImlhdCI6MTc4MjMxNzE3MiwiZXhwIjoxNzkwMDkzMTcyfQ.E3dgLjaKS9Ali_PxB5o7QCSnODn-6LEa3-rzM-cIwWU
```

---

### quotations_specialist

**Payload**
```json
{
  "sub": 4,
  "name": "Test Quotations Spec",
  "email": "qs@efar.sg",
  "role": "quotations_specialist"
}
```

**Token**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjQsIm5hbWUiOiJUZXN0IFF1b3RhdGlvbnMgU3BlYyIsImVtYWlsIjoicXNAZWZhci5zZyIsInJvbGUiOiJxdW90YXRpb25zX3NwZWNpYWxpc3QiLCJpYXQiOjE3ODIzMTcxNzIsImV4cCI6MTc5MDA5MzE3Mn0.H0Ws23E6Zewt5Vp1BH2YPXkur8wCkcAdOGXO1aoSckI
```

---

### field_crew

**Payload**
```json
{
  "sub": 5,
  "name": "Test Field Crew",
  "email": "crew@efar.sg",
  "role": "field_crew"
}
```

**Token**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjUsIm5hbWUiOiJUZXN0IEZpZWxkIENyZXciLCJlbWFpbCI6ImNyZXdAZWZhci5zZyIsInJvbGUiOiJmaWVsZF9jcmV3IiwiaWF0IjoxNzgyMzE3MTcyLCJleHAiOjE3OTAwOTMxNzJ9.yXwtDqQlVqRmabCnSKoPheMp5YizjOfq3bvRvEvNnkA
```

---

## Regenerating tokens

If the secret changes or tokens expire, run this from the `backend/` directory:

```bash
node -e "
const jwt = require('jsonwebtoken')
const SECRET = process.env.DEV_JWT_SECRET || 'dev-secret-efar'
const users = [
  { id: 1, name: 'Test Managing Director', email: 'md@efar.sg',   role: 'managing_director'    },
  { id: 2, name: 'Test AR Specialist',     email: 'ar@efar.sg',   role: 'ar_specialist'        },
  { id: 3, name: 'Test AP Specialist',     email: 'ap@efar.sg',   role: 'ap_specialist'        },
  { id: 4, name: 'Test Quotations Spec',   email: 'qs@efar.sg',   role: 'quotations_specialist' },
  { id: 5, name: 'Test Field Crew',        email: 'crew@efar.sg', role: 'field_crew'           },
]
users.forEach(u => {
  const token = jwt.sign({ sub: u.id, name: u.name, email: u.email, role: u.role }, SECRET, { expiresIn: '90d' })
  console.log(u.role + ': ' + token)
})
"
```
