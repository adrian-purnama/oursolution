# Graph Report - fedier  (2026-11-11)

## Corpus Check
- 217 files · ~80,744 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1372 nodes · 3212 edges · 96 communities (71 shown, 25 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 43 edges (avg confidence: 0.55)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `bfda7869`
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
- auth.service.test.ts
- RolesAdminForm.tsx
- app-config.tsx
- route.tsx
- purchase.model.ts
- dependencies
- brandingContext.tsx
- pricing.tsx
- $productId.tsx
- route.tsx
- pricing.tsx
- multer
- @types/cors
- dependencies
- useAuth
- ProfileForm.tsx
- auth.route.ts
- $userId.tsx
- components.json
- route.tsx
- devDependencies
- UsersAdminForm.tsx
- index.tsx
- $productId.tsx
- helmet
- mongoose
- typescript
- .toOut
- deployment.controller.ts
- deployment.model.ts
- package.json
- scripts
- purchase.model.ts
- popover.tsx
- appConfig.controller.ts
- route.tsx
- @getbrevo/brevo
- lucide-react
- react
- tsconfig.json
- react-dom
- react-hot-toast
- tailwindcss
- register.tsx
- $productId.tsx
- purchase.model.ts
- deployments.tsx
- route.tsx
- mongoose
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
1. `cn()` - 59 edges
2. `DeploymentService` - 33 edges
3. `UserModel` - 28 edges
4. `apiFetch()` - 27 edges
5. `parseRouteId()` - 25 edges
6. `useAuth()` - 24 edges
7. `FileRoutesByPath` - 23 edges
8. `ProductModel` - 22 edges
9. `Button()` - 21 edges
10. `UserProductService` - 20 edges

## Surprising Connections (you probably didn't know these)
- `ProfileForm()` --indirect_call--> `run()`  [INFERRED]
  frontend/src/components/forms/profile/ProfileForm.tsx → backend/src/middleware/requireAdmin.test.ts
- `UserProductsForm()` --indirect_call--> `period()`  [INFERRED]
  frontend/src/components/forms/admin/UserProductsForm.tsx → backend/src/modules/userProduct/userProduct.planner.test.ts
- `PlanGantt()` --indirect_call--> `period()`  [INFERRED]
  frontend/src/components/PlanGantt.tsx → backend/src/modules/userProduct/userProduct.planner.test.ts
- `pickEnvironment()` --indirect_call--> `compose()`  [INFERRED]
  backend/src/modules/dokploy/dokploy.service.ts → backend/src/utils/deploymentFolders.test.ts
- `Field()` --calls--> `cn()`  [EXTRACTED]
  frontend/src/components/forms/admin/DeploymentsAdminForm.tsx → frontend/src/lib/utils.ts

## Import Cycles
- None detected.

## Communities (96 total, 25 thin omitted)

### Community 0 - "mcp.service.ts"
Cohesion: 0.18
Nodes (11): ProductSummaryDto, PeriodEndSpec, ProductPeriodOutDto, UserProductRowOutDto, PRODUCT_PERIOD_SOURCES, ProductPeriodSource, UserProductPeriodInterface, userProductPeriodSchema (+3 more)

### Community 1 - "parseApiKeyId"
Cohesion: 0.28
Nodes (7): AssignProductDto, UserPlanOutDto, UserProductPeriodModel, AppendPlan, liveFilter(), toPeriodLike(), UserProductService

### Community 2 - "utils.ts"
Cohesion: 0.11
Nodes (17): CheckoutInDto, CheckoutOutDto, PAYMENT_STATUSES, PaymentInterface, PaymentStatus, paymentSchema, PaymentController, allowAllProvider (+9 more)

### Community 3 - "index.ts"
Cohesion: 0.20
Nodes (12): fail(), ok(), PurchaseController, fail(), ok(), UserProductController, paymentController, purchaseController (+4 more)

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
Cohesion: 0.06
Nodes (34): Route, AdminAppConfigRoute, AdminDeploymentsRoute, AdminIndexRoute, AdminProductsIndexRoute, AdminProductsNewRoute, AdminProductsProductIdRoute, AdminRouteRoute (+26 more)

### Community 9 - "SandboxOcrForm.tsx"
Cohesion: 0.40
Nodes (4): Boundaries, Examples, Format, Scoring

### Community 10 - "apiKeyValidation.ts"
Cohesion: 0.17
Nodes (17): period(), UserProductsForm(), chartWindow(), describePeriod(), percent(), PlanGantt(), Range, rowStatus() (+9 more)

### Community 11 - "ProjectSidebar.tsx"
Cohesion: 0.50
Nodes (3): Boundaries, Output, Scan

### Community 12 - "widget.dto.ts"
Cohesion: 0.07
Nodes (27): Footer(), FOOTER_COLUMNS, FooterLink, ADMIN_LINK, DASHBOARD_LINK, Header(), HOME_LINK, NavLink (+19 more)

### Community 13 - "app-config.tsx"
Cohesion: 0.09
Nodes (31): checkDeployment(), DeploymentDraft, DeploymentFields(), EMPTY_DEPLOYMENT, fieldElementId(), focusField(), IssueRow(), toDeploymentBody() (+23 more)

### Community 14 - "package.json"
Cohesion: 0.13
Nodes (9): Route, Route, Route, Route, Route, Route, Route, FileRoutesById (+1 more)

### Community 15 - "index.tsx"
Cohesion: 0.18
Nodes (26): GrantPurchaseInDto, DEPLOYMENT_TYPES, PRODUCT_KINDS, asRecord(), parseAccessUrl(), parseAssignProductDto(), parseBoolean(), parseCheckoutInDto() (+18 more)

### Community 16 - "index.tsx"
Cohesion: 0.25
Nodes (6): getRouter(), Register, @tanstack/react-router, Register, routeTree, startInstance

### Community 17 - "route.tsx"
Cohesion: 0.21
Nodes (18): customerFolders, hostPaths(), interpolate(), isInside(), isRecord(), isUnderDataRoot(), mountSources(), mountVariables() (+10 more)

### Community 19 - "index.ts"
Cohesion: 0.17
Nodes (14): publicFileUrl(), ProductOutDto, UpdateProductDto, PaymentModel, ProductModel, isDuplicateKeyError(), liveFilter(), ProductDoc (+6 more)

### Community 21 - "TopicModel"
Cohesion: 0.17
Nodes (8): DeploymentOutDto, DeploymentModel, DeploymentRunModel, DeploymentDoc, DeploymentService, isDuplicateKeyError(), messageOf(), RunDoc

### Community 22 - "new.tsx"
Cohesion: 0.21
Nodes (13): AdminUserDetailOutDto, AdminUserOutDto, UpdateAdminUserDto, USER_ROLES, UserRole, AppConfigPayload, AdminService, toAdminUser() (+5 more)

### Community 24 - "widget.service.ts"
Cohesion: 0.18
Nodes (16): checkDockerCompose(), checkEnvFile(), closest(), closingBrace(), ComposeIssue, ComposeIssueSeverity, editDistance(), Entry (+8 more)

### Community 25 - "register.tsx"
Cohesion: 0.19
Nodes (15): CheckoutButton(), CheckoutResult, ProductStatusBadge(), useProductAccess(), Detail(), State, ProductImage(), Props (+7 more)

### Community 26 - "Spline 3D"
Cohesion: 0.24
Nodes (6): HASH, brand(), escapeHtml(), layout(), mailer, MailService

### Community 27 - "purchase.service.ts"
Cohesion: 0.16
Nodes (11): AuthError, credentialRateLimit, deploymentRateLimit, otpRateLimit, readBearer(), requireAuth(), requireUser, authController (+3 more)

### Community 28 - "compilerOptions"
Cohesion: 0.07
Nodes (27): compilerOptions, allowImportingTsExtensions, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+19 more)

### Community 30 - "purchase.model.ts"
Cohesion: 0.33
Nodes (5): PurchaseOutDto, PurchaseModel, toProductSummary(), isDuplicateKeyError(), PurchaseService

### Community 31 - "devDependencies"
Cohesion: 0.08
Nodes (25): eslint, devDependencies, eslint, prettier, @tailwindcss/typography, @tanstack/devtools-vite, @tanstack/eslint-config, @tanstack/router-cli (+17 more)

### Community 32 - "normalizeImage"
Cohesion: 0.16
Nodes (7): AppConfigInterface, AppConfigModel, appConfigSchema, UserModel, userSchema, FakeUser, AppConfigService

### Community 33 - "auth.service.test.ts"
Cohesion: 0.17
Nodes (11): requireAdmin(), run(), upload, uploadSingleImage(), adminController, deploymentController, dokployController, productController (+3 more)

### Community 34 - "RolesAdminForm.tsx"
Cohesion: 0.10
Nodes (21): AppConfigData, AppConfigForm(), ToggleRow(), Stepper(), ProductBadge(), ProductMark(), DropdownMenuCheckboxItem(), DropdownMenuContent() (+13 more)

### Community 36 - "route.tsx"
Cohesion: 0.37
Nodes (3): fail(), ok(), ProductController

### Community 37 - "purchase.model.ts"
Cohesion: 0.09
Nodes (43): CHECK_TEXT, DeploymentRow(), DeploymentsAdminForm(), Field(), FilterKey, FILTERS, lastUpAt(), matches() (+35 more)

### Community 38 - "dependencies"
Cohesion: 0.08
Nodes (25): class-variance-authority, clsx, cmdk, cn, dependencies, class-variance-authority, clsx, cmdk (+17 more)

### Community 39 - "brandingContext.tsx"
Cohesion: 0.11
Nodes (20): DokployProjectOutDto, cloudflareTunnelId(), dokployUrl(), isDevelopmentBuild(), jwtSecret(), required(), DokployController, containersOutcome (+12 more)

### Community 40 - "pricing.tsx"
Cohesion: 0.19
Nodes (16): DeploymentActionInDto, DeploymentRunOutDto, DeploymentVariableOutDto, RunStepOutDto, UpdateDeploymentValuesInDto, DeploymentRunInterface, RUN_ACTIONS, RUN_STATUSES (+8 more)

### Community 42 - "route.tsx"
Cohesion: 0.18
Nodes (11): ServiceBeatOutDto, ServiceCheckState, isRecord(), Json, messageOf(), monitorPayload(), MonitorStatus, STATES (+3 more)

### Community 43 - "pricing.tsx"
Cohesion: 0.29
Nodes (7): CloudflareService, DnsRecord, IngressRule, isRecord(), Json, withoutRoute(), withRoute()

### Community 44 - "multer"
Cohesion: 0.38
Nodes (4): ChangeAppLogoInput, ALLOWED_FORMATS, NormalizedImage, normalizeImage()

### Community 45 - "@types/cors"
Cohesion: 0.15
Nodes (10): DokployProjectCombobox(), Command(), CommandEmpty(), CommandGroup(), CommandInput(), CommandItem(), CommandList(), Popover() (+2 more)

### Community 46 - "dependencies"
Cohesion: 0.10
Nodes (21): dependencies, bcrypt, cors, express, express-rate-limit, helmet, jsonwebtoken, multer (+13 more)

### Community 47 - "useAuth"
Cohesion: 0.24
Nodes (15): Bucket, buckets, deleteFile(), deleteFileIfExists(), findFile(), getBucket(), GridFsFileResult, openDownload() (+7 more)

### Community 48 - "ProfileForm.tsx"
Cohesion: 0.18
Nodes (18): ACTION_LABELS, allowedActions(), BUSY_STATES, mayBeRunning(), nextAllowedStart(), PIPELINES, shouldAutoTurnOff(), START_HISTORY_MS (+10 more)

### Community 49 - "auth.route.ts"
Cohesion: 0.16
Nodes (18): AuthContext, AuthContextValue, AuthProvider(), AuthUser, bootstrapAuth(), clearToken(), fetchValidatedUser(), getToken() (+10 more)

### Community 50 - "$userId.tsx"
Cohesion: 0.31
Nodes (7): Tabs(), TabsContent(), TabsList(), tabsListVariants, TabsTrigger(), Route, UserTab

### Community 51 - "components.json"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 52 - "route.tsx"
Cohesion: 0.16
Nodes (14): connectDatabase(), ApiResponseDto, bootstrap(), createApp(), format(), location(), logger, AppConfigController (+6 more)

### Community 53 - "devDependencies"
Cohesion: 0.10
Nodes (21): devDependencies, prettier, @tsconfig/node22, tsx, @types/bcrypt, @types/cors, @types/express, @types/jsonwebtoken (+13 more)

### Community 57 - "helmet"
Cohesion: 0.27
Nodes (11): BUILT_IN_VARIABLES, BuiltInVariable, checkDeployment(), DeploymentCheckResult, isBuiltIn(), renderTemplate(), scanTemplate(), GOOD (+3 more)

### Community 58 - "mongoose"
Cohesion: 0.30
Nodes (12): activePeriod(), assertDeletable(), byStart(), liveSchedule(), OverridePlan, PeriodLike, planAppend(), planEndNow() (+4 more)

### Community 60 - ".toOut"
Cohesion: 0.33
Nodes (7): ServiceStatusOutDto, builtInsFor(), resetFoldersOf(), toRunOut(), valuesOf(), resolveDeployment(), usernameFromEmail()

### Community 61 - "deployment.controller.ts"
Cohesion: 0.23
Nodes (12): AdminDeploymentRowOutDto, DeploymentController, fail(), ok(), productIdOf(), target(), DeploymentBusyError, DeploymentLimitError (+4 more)

### Community 62 - "deployment.model.ts"
Cohesion: 0.24
Nodes (10): DEPLOYMENT_STATES, DeploymentInterface, DeploymentMonitor, DeploymentState, DeploymentValue, DokployLink, deploymentSchema, dokploySchema (+2 more)

### Community 63 - "package.json"
Cohesion: 0.22
Nodes (8): imports, name, pnpm, onlyBuiltDependencies, private, type, esbuild, lightningcss

### Community 64 - "scripts"
Cohesion: 0.22
Nodes (9): scripts, build, check, dev, format, generate-routes, lint, preview (+1 more)

### Community 65 - "purchase.model.ts"
Cohesion: 0.26
Nodes (8): env, authenticateByToken(), UserInterface, Express, Request, AccessTokenPayload, signAccessToken(), verifyAccessToken()

### Community 66 - "popover.tsx"
Cohesion: 0.24
Nodes (10): DeploymentDomain, DeploymentType, DeploymentVariable, ProductInterface, VARIABLE_VISIBILITIES, deploymentSchema, domainSchema, productSchema (+2 more)

### Community 67 - "appConfig.controller.ts"
Cohesion: 0.31
Nodes (7): CheckDeploymentInDto, CheckDeploymentOutDto, CreateProductDto, PricingProductOutDto, ProductDeployment, ProductKind, ProductNotFoundError

### Community 72 - "tsconfig.json"
Cohesion: 0.22
Nodes (8): compilerOptions, forceConsistentCasingInFileNames, outDir, rootDir, extends, include, src/**/*.ts, @tsconfig/node22/tsconfig.json

### Community 78 - "purchase.model.ts"
Cohesion: 0.47
Nodes (4): PURCHASE_SOURCES, PurchaseInterface, PurchaseSource, purchaseSchema

### Community 89 - "router.tsx"
Cohesion: 0.17
Nodes (12): LoginInDto, LoginOutDto, RegisterInDto, RegisterOutDto, ResetPasswordInDto, ResetPasswordOutDto, SendOtpInDto, AuthService (+4 more)

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
Cohesion: 0.10
Nodes (24): UserDetailForm(), UserPatch, UserPurchasesForm(), UsersAdminForm(), LoginForm(), LoginResponse, RegisterForm(), RegisterResponse (+16 more)

### Community 110 - "ListPagination.tsx"
Cohesion: 0.16
Nodes (18): ProductsAdminForm(), EndChoice, Mode, Scheduled, Dialog(), DialogContent(), DialogDescription(), DialogFooter() (+10 more)

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
- **329 isolated node(s):** `name`, `version`, `description`, `dev`, `start` (+324 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **25 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `run()` connect `auth.service.test.ts` to `.toOut`, `TopicModel`, `SandboxChatForm.tsx`?**
  _High betweenness centrality (0.211) - this node is a cross-community bridge._
- **Why does `ProfileForm()` connect `SandboxChatForm.tsx` to `auth.service.test.ts`, `apiKeyValidation.ts`?**
  _High betweenness centrality (0.210) - this node is a cross-community bridge._
- **Why does `apiFetch()` connect `SandboxChatForm.tsx` to `RolesAdminForm.tsx`, `purchase.model.ts`, `apiKeyValidation.ts`, `widget.dto.ts`, `@types/cors`, `app-config.tsx`, `ListPagination.tsx`, `auth.route.ts`, `register.tsx`?**
  _High betweenness centrality (0.128) - this node is a cross-community bridge._
- **What connects `name`, `version`, `description` to the rest of the system?**
  _329 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `utils.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1103448275862069 - nodes in this community are weakly interconnected._
- **Should `routeTree.gen.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05714285714285714 - nodes in this community are weakly interconnected._
- **Should `widget.dto.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07317073170731707 - nodes in this community are weakly interconnected._