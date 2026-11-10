# Graph Report - fedier  (2026-11-10)

## Corpus Check
- 167 files · ~44,418 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 927 nodes · 1936 edges · 60 communities (45 shown, 15 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 26 edges (avg confidence: 0.55)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `08729f79`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- mcp.service.ts
- parseApiKeyId
- utils.ts
- index.ts
- contentReferences.ts
- authContext.tsx
- article.ts
- cn
- routeTree.gen.ts
- SandboxOcrForm.tsx
- apiKeyValidation.ts
- ProjectSidebar.tsx
- widget.dto.ts
- app-config.tsx
- package.json
- index.tsx
- index.tsx
- route.tsx
- scan.ts
- index.ts
- Stitch to Remotion Walkthrough Videos
- TopicModel
- new.tsx
- login.tsx
- widget.service.ts
- register.tsx
- Spline 3D
- purchase.service.ts
- compilerOptions
- AuthController
- purchase.model.ts
- devDependencies
- normalizeImage
- product.controller.ts
- RolesAdminForm.tsx
- app-config.tsx
- route.tsx
- index.tsx
- dependencies
- brandingContext.tsx
- pricing.tsx
- dependencies
- useAuth
- components.json
- devDependencies
- tsconfig.json
- router.tsx
- Fedier template
- package.json
- scripts
- SandboxChatForm.tsx
- ListPagination.tsx
- tsconfig.build.json
- SideDrawer.tsx
- prettier.config.js
- vite.config.ts
- CLAUDE.md
- AGENTS.md

## God Nodes (most connected - your core abstractions)
1. `cn()` - 42 edges
2. `useAuth()` - 23 edges
3. `UserModel` - 21 edges
4. `parseRouteId()` - 19 edges
5. `apiFetch()` - 18 edges
6. `FileRoutesByPath` - 18 edges
7. `AppConfigService` - 17 edges
8. `compilerOptions` - 17 edges
9. `UserProductService` - 16 edges
10. `ApiResponseDto` - 14 edges

## Surprising Connections (you probably didn't know these)
- `PlanGantt()` --indirect_call--> `period()`  [INFERRED]
  frontend/src/components/PlanGantt.tsx → backend/src/modules/userProduct/userProduct.planner.test.ts
- `ProfileForm()` --indirect_call--> `run()`  [INFERRED]
  frontend/src/components/forms/profile/ProfileForm.tsx → backend/src/middleware/requireAdmin.test.ts
- `UserProductsForm()` --indirect_call--> `period()`  [INFERRED]
  frontend/src/components/forms/admin/UserProductsForm.tsx → backend/src/modules/userProduct/userProduct.planner.test.ts
- `RegisterForm()` --calls--> `useAuth()`  [EXTRACTED]
  frontend/src/components/forms/auth/RegisterForm.tsx → frontend/src/context/authContext.tsx
- `SelectLabel()` --calls--> `cn()`  [EXTRACTED]
  frontend/src/components/ui/select.tsx → frontend/src/lib/utils.ts

## Import Cycles
- None detected.

## Communities (60 total, 15 thin omitted)

### Community 0 - "mcp.service.ts"
Cohesion: 0.11
Nodes (19): Bucket, buckets, deleteFile(), deleteFileIfExists(), findFile(), getBucket(), GridFsFileResult, openDownload() (+11 more)

### Community 1 - "parseApiKeyId"
Cohesion: 0.12
Nodes (29): AssignProductDto, PeriodEndSpec, ProductPeriodOutDto, UserPlanOutDto, UserProductRowOutDto, PRODUCT_PERIOD_SOURCES, ProductPeriodSource, UserProductPeriodInterface (+21 more)

### Community 2 - "utils.ts"
Cohesion: 0.12
Nodes (17): CheckoutInDto, CheckoutOutDto, PAYMENT_STATUSES, PaymentInterface, PaymentStatus, PaymentModel, paymentSchema, allowAllProvider (+9 more)

### Community 3 - "index.ts"
Cohesion: 0.08
Nodes (22): requireAdmin(), run(), upload, uploadSingleImage(), AdminController, adminController, productController, purchaseController (+14 more)

### Community 4 - "contentReferences.ts"
Cohesion: 0.22
Nodes (8): Boundaries, Intensity, Output, Persistence, Ponytail, Rules, The ladder, When NOT to be lazy

### Community 5 - "authContext.tsx"
Cohesion: 0.25
Nodes (7): Configure Default Mode, Deactivate, Levels, More, Ponytail Help, Skills, Update

### Community 6 - "article.ts"
Cohesion: 0.40
Nodes (4): Boundaries, Honesty boundary, Ponytail Gain, Scoreboard

### Community 7 - "cn"
Cohesion: 0.40
Nodes (4): Boundaries, Hunt, Output, Tags

### Community 8 - "routeTree.gen.ts"
Cohesion: 0.07
Nodes (30): Route, AdminAppConfigRoute, AdminIndexRoute, AdminProductsRoute, AdminRouteRoute, AdminRouteRouteChildren, AdminRouteRouteWithChildren, AdminUsersIndexRoute (+22 more)

### Community 9 - "SandboxOcrForm.tsx"
Cohesion: 0.40
Nodes (4): Boundaries, Examples, Format, Scoring

### Community 10 - "apiKeyValidation.ts"
Cohesion: 0.12
Nodes (25): ProductsAdminForm(), CheckoutResult, PricingGrid(), State, chartWindow(), describePeriod(), percent(), PlanGantt() (+17 more)

### Community 11 - "ProjectSidebar.tsx"
Cohesion: 0.50
Nodes (3): Boundaries, Output, Scan

### Community 12 - "widget.dto.ts"
Cohesion: 0.24
Nodes (7): bootstrapBranding(), Branding, BrandingContext, BrandingContextValue, BrandingProvider(), fetchBranding(), invalidateBrandingCache()

### Community 13 - "app-config.tsx"
Cohesion: 0.21
Nodes (9): UserPatch, UsersAdminForm(), Props, AdminUser, AdminUserDetail, USER_ROLE_LABELS, UserRole, paginate() (+1 more)

### Community 14 - "package.json"
Cohesion: 0.15
Nodes (6): Route, Route, Route, Route, Route, FileRoutesByPath

### Community 15 - "index.tsx"
Cohesion: 0.22
Nodes (5): Feature, FeatureGrid(), FEATURES, STEPS, Route

### Community 16 - "index.tsx"
Cohesion: 0.25
Nodes (6): getRouter(), Register, @tanstack/react-router, Register, routeTree, startInstance

### Community 17 - "route.tsx"
Cohesion: 0.28
Nodes (16): asRecord(), parseAccessUrl(), parseAssignProductDto(), parseBoolean(), parseCheckoutInDto(), parseColor(), parseCreateProductDto(), parseDays() (+8 more)

### Community 22 - "new.tsx"
Cohesion: 0.25
Nodes (11): CreateProductDto, PricingProductOutDto, ProductSummaryDto, UpdateProductDto, GrantPurchaseInDto, PRODUCT_KINDS, ProductInterface, ProductKind (+3 more)

### Community 24 - "widget.service.ts"
Cohesion: 0.08
Nodes (25): connectDatabase(), bootstrap(), createApp(), format(), location(), logger, AuthError, credentialRateLimit (+17 more)

### Community 25 - "register.tsx"
Cohesion: 0.35
Nodes (6): publicFileUrl(), ProductOutDto, ProductModel, ProductDoc, ProductService, toProductOut()

### Community 27 - "purchase.service.ts"
Cohesion: 0.35
Nodes (4): PurchaseOutDto, PurchaseModel, isDuplicateKeyError(), PurchaseService

### Community 28 - "compilerOptions"
Cohesion: 0.07
Nodes (27): compilerOptions, allowImportingTsExtensions, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+19 more)

### Community 30 - "purchase.model.ts"
Cohesion: 0.47
Nodes (4): PURCHASE_SOURCES, PurchaseInterface, PurchaseSource, purchaseSchema

### Community 31 - "devDependencies"
Cohesion: 0.05
Nodes (42): eslint, devDependencies, eslint, prettier, @tailwindcss/typography, @tanstack/devtools-vite, @tanstack/eslint-config, @tanstack/router-cli (+34 more)

### Community 32 - "normalizeImage"
Cohesion: 0.60
Nodes (3): ALLOWED_FORMATS, NormalizedImage, normalizeImage()

### Community 34 - "RolesAdminForm.tsx"
Cohesion: 0.09
Nodes (27): Footer(), FOOTER_COLUMNS, FooterLink, AppConfigData, AppConfigForm(), ToggleRow(), ADMIN_LINK, DASHBOARD_LINK (+19 more)

### Community 38 - "dependencies"
Cohesion: 0.06
Nodes (33): class-variance-authority, clsx, cn, dependencies, class-variance-authority, clsx, cn, lucide-react (+25 more)

### Community 39 - "brandingContext.tsx"
Cohesion: 0.19
Nodes (9): period(), UserDetailForm(), UserProductsForm(), UserPurchasesForm(), LoginForm(), FinalCta(), HeroSection(), useAuth() (+1 more)

### Community 46 - "dependencies"
Cohesion: 0.10
Nodes (21): dependencies, bcrypt, cors, express, express-rate-limit, @getbrevo/brevo, helmet, jsonwebtoken (+13 more)

### Community 47 - "useAuth"
Cohesion: 0.15
Nodes (14): LoginResponse, RegisterForm(), RegisterResponse, readOnlyInputClassName, ResetPasswordForm(), PasswordInput(), PasswordInputProps, getToken() (+6 more)

### Community 51 - "components.json"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 53 - "devDependencies"
Cohesion: 0.10
Nodes (21): devDependencies, prettier, @tsconfig/node22, tsx, @types/bcrypt, @types/cors, @types/express, @types/jsonwebtoken (+13 more)

### Community 72 - "tsconfig.json"
Cohesion: 0.22
Nodes (8): compilerOptions, forceConsistentCasingInFileNames, outDir, rootDir, extends, include, src/**/*.ts, @tsconfig/node22/tsconfig.json

### Community 89 - "router.tsx"
Cohesion: 0.05
Nodes (46): AdminUserDetailOutDto, AdminUserOutDto, UpdateAdminUserDto, LoginInDto, LoginOutDto, RegisterInDto, RegisterOutDto, ResetPasswordInDto (+38 more)

### Community 94 - "Fedier template"
Cohesion: 0.18
Nodes (9): Frontend, Commands, Environment, Fedier template, Layout, Products and plans, Run it locally, Security notes (+1 more)

### Community 101 - "package.json"
Cohesion: 0.25
Nodes (7): author, description, keywords, license, name, type, version

### Community 102 - "scripts"
Cohesion: 0.25
Nodes (8): scripts, build, dev, format, format:check, start, test, type-check

### Community 103 - "SandboxChatForm.tsx"
Cohesion: 0.20
Nodes (14): AuthContext, AuthContextValue, AuthProvider(), AuthUser, bootstrapAuth(), clearToken(), fetchValidatedUser(), invalidateAuthCache() (+6 more)

### Community 110 - "ListPagination.tsx"
Cohesion: 0.11
Nodes (25): Draft, EMPTY_DRAFT, EndChoice, Mode, Scheduled, Button(), buttonVariants, Dialog() (+17 more)

### Community 116 - "tsconfig.build.json"
Cohesion: 0.40
Nodes (4): exclude, extends, src/**/*.test.ts, ./tsconfig.json

### Community 122 - "SideDrawer.tsx"
Cohesion: 0.24
Nodes (8): OtpInterface, OtpPurpose, OtpModel, otpSchema, hashOtp(), OtpCooldownError, OtpService, safeEqual()

### Community 133 - "CLAUDE.md"
Cohesion: 0.50
Nodes (3): 🌍 Always-Apply Rules (Global Context), 🎯 Auto-Select Rules (File-Specific), Project Notes

## Knowledge Gaps
- **269 isolated node(s):** `name`, `version`, `description`, `dev`, `start` (+264 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `period()` connect `brandingContext.tsx` to `parseApiKeyId`, `apiKeyValidation.ts`?**
  _High betweenness centrality (0.162) - this node is a cross-community bridge._
- **Why does `UserProductsForm()` connect `brandingContext.tsx` to `apiKeyValidation.ts`, `ListPagination.tsx`, `useAuth`?**
  _High betweenness centrality (0.110) - this node is a cross-community bridge._
- **What connects `name`, `version`, `description` to the rest of the system?**
  _269 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `mcp.service.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11174242424242424 - nodes in this community are weakly interconnected._
- **Should `parseApiKeyId` be split into smaller, more focused modules?**
  _Cohesion score 0.11613475177304965 - nodes in this community are weakly interconnected._
- **Should `utils.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11822660098522167 - nodes in this community are weakly interconnected._
- **Should `index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08078431372549019 - nodes in this community are weakly interconnected._