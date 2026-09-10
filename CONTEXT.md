# Lobster Knight Community

This context describes the first-stage people-and-organizations domain for the Lobster Knight community. It defines who participates in the platform, what identities they can hold, and how FDEs belong to consulting companies.

## Language

**User**:
A natural-person account in the community. A User can acquire multiple platform identities over time.
_Avoid_: account role, member as a synonym for User

**Platform Identity**:
A non-exclusive identity attached to a User at the platform level, such as Customer or FDE. Company-specific permissions are not Platform Identities.
_Avoid_: single role, global role

**FDE**:
A User confirmed by the platform as a Lobster Knight. In the first stage, the FDE has a profile after confirmation; a separate FDE application is not modeled yet.
_Avoid_: candidate status, certification level

**Company**:
A consulting company represented as a first-class organization in the community from the moment onboarding begins. A Company is not a text field on a User profile.
_Avoid_: employer name, company string

**Company Member**:
The relationship between a User and a Company. Company Role and FDE formal belonging are independent dimensions of this relationship; company member views are grouped as Owner, Admin, and Lobster Knight.
_Avoid_: deleting historical membership

**FDE Formal Belonging**:
The platform-confirmed active organizational belonging between an FDE and one approved Company. In product language, an FDE with this belonging is shown as a Lobster Knight of that Company and counted in that Company's Lobster Knight total. An FDE can have at most one active FDE Formal Belonging, and cannot start a new belonging process while one is active.
_Avoid_: weak relationship, activity cooperation, project cooperation

**Join Request**:
An FDE-initiated request to establish FDE Formal Belonging to one approved Company. An FDE can have at most one pending Join Request; rejected, cancelled, and expired requests are ended states and do not block future requests.
_Avoid_: active belonging

**Invitation**:
A Company-initiated request for an FDE to establish FDE Formal Belonging. Invitation is outside the first-stage scope.
_Avoid_: first-stage invitation flow

**Owner**:
A Company Role held through a Company Member relationship. A Company must have exactly one Owner, and the approved onboarding applicant automatically becomes the first Owner; Owner transfer is outside the first-stage scope.
_Avoid_: global owner identity

**Admin**:
A Company Role held through a Company Member relationship. A Company can have multiple Admins, and Owner or Admin rights do not require FDE identity.
_Avoid_: global company admin identity

**Company Alignment**:
A User's Company Role and active FDE Formal Belonging must align to the same Company. A User cannot be an Owner or Admin of one Company while being a Lobster Knight formally belonging to another Company, and cannot request Lobster Knight belonging to another Company while holding an Owner or Admin role.
_Avoid_: cross-company admin belonging

**Owner Transfer**:
The confirmed handover of a Company's Owner role. Owner Transfer is outside the first-stage scope.
_Avoid_: first-stage owner handover

**Company Release**:
The end of active FDE Formal Belonging between an FDE and a Company. In the first stage, only the Company's Owner or Admin can initiate release; the FDE cannot initiate self-release. It takes effect immediately after confirmation and preserves history.
_Avoid_: deleting history, removing company role

**Company Onboarding**:
The lifecycle of a Company from draft through review. A Company starts as draft while onboarding information is filled, becomes pending after submission, and can then become requires changes, approved, or rejected; rejected onboarding keeps its Company record so it can be revised and resubmitted.
_Avoid_: creating Company only after approval

**Platform Admin**:
A platform governance role that confirms FDE identity and reviews Company onboarding. In the first stage, Platform Admin does not force-transfer ownership or directly override Company Role and FDE Formal Belonging relationships.
_Avoid_: universal relationship operator
