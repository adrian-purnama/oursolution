# Graph Report - fedier  (2026-11-11)

## Corpus Check
- 243 files · ~96,155 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1613 nodes · 3941 edges · 103 communities (78 shown, 25 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 46 edges (avg confidence: 0.55)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1ed4d676`
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
- Header.tsx
- index.tsx
- index.tsx
- index.tsx
- $productId.tsx
- router.tsx
- route.tsx
- $paymentId.tsx
- multer
- Fedier template
- @types/qrcode
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
1. `cn()` - 67 edges
2. `UserModel` - 35 edges
3. `DeploymentService` - 33 edges
4. `parseRouteId()` - 32 edges
5. `apiFetch()` - 32 edges
6. `useAuth()` - 28 edges
7. `Button()` - 27 edges
8. `FileRoutesByPath` - 26 edges
9. `ProductModel` - 24 edges
10. `UserProductService` - 20 edges

## Surprising Connections (you probably didn't know these)
- `ProductsPlansForm()` --indirect_call--> `run()`  [INFERRED]
  frontend/src/components/forms/profile/ProductsPlansForm.tsx → backend/src/middleware/requireAdmin.test.ts
- `UserProductsForm()` --indirect_call--> `period()`  [INFERRED]
  frontend/src/components/forms/admin/UserProductsForm.tsx → backend/src/modules/userProduct/userProduct.planner.test.ts
- `PlanGantt()` --indirect_call--> `period()`  [INFERRED]
  frontend/src/components/PlanGantt.tsx → backend/src/modules/userProduct/userProduct.planner.test.ts
- `PaymentItemOutDto` --references--> `ProductKind`  [EXTRACTED]
  backend/src/dto/payment.dto.ts → backend/src/models/product/product.interface.ts
- `pickEnvironment()` --indirect_call--> `compose()`  [INFERRED]
  backend/src/modules/dokploy/dokploy.service.ts → backend/src/utils/deploymentFolders.test.ts

## Import Cycles
- None detected.

## Communities (103 total, 25 thin omitted)

### Community 0 - "mcp.service.ts"
Cohesion: 0.19
Nodes (18): InvoiceDetail(), metaLine(), paidWith(), State, itemsSummary(), PaymentStatusBadge(), PaymentTable(), STATUS_CLASSES (+10 more)

### Community 1 - "parseApiKeyId"
Cohesion: 0.10
Nodes (30): AssignProductDto, PeriodEndSpec, ProductPeriodOutDto, UserPlanOutDto, UserProductRowOutDto, PRODUCT_PERIOD_SOURCES, ProductPeriodSource, UserProductPeriodInterface (+22 more)

### Community 2 - "utils.ts"
Cohesion: 0.08
Nodes (24): formatInvoiceNumber(), FetchLike, itemName(), MidtransConfig, MidtransNotification, MidtransProvider, midtransStatus(), allowAllProvider (+16 more)

### Community 3 - "index.ts"
Cohesion: 0.14
Nodes (19): State, ApiResponse, addToBasket(), CheckoutItem, CheckoutLine, CheckoutQuote, CheckoutResult, idr (+11 more)

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
Cohesion: 0.05
Nodes (39): Route, Route, AdminAppConfigRoute, AdminDeploymentsRoute, AdminIndexRoute, AdminProductsIndexRoute, AdminProductsNewRoute, AdminProductsProductIdRoute (+31 more)

### Community 9 - "SandboxOcrForm.tsx"
Cohesion: 0.40
Nodes (4): Boundaries, Examples, Format, Scoring

### Community 10 - "apiKeyValidation.ts"
Cohesion: 0.18
Nodes (17): period(), UserProductsForm(), chartWindow(), describePeriod(), joins(), percent(), PlanGantt(), Range (+9 more)

### Community 11 - "ProjectSidebar.tsx"
Cohesion: 0.50
Nodes (3): Boundaries, Output, Scan

### Community 12 - "widget.dto.ts"
Cohesion: 0.16
Nodes (8): Feature, FeatureGrid(), FEATURES, HowItWorks(), STEPS, PricingGrid(), Route, Route

### Community 13 - "app-config.tsx"
Cohesion: 0.09
Nodes (27): checkDeployment(), DeploymentDraft, DeploymentFields(), EMPTY_DEPLOYMENT, fieldElementId(), focusField(), IssueRow(), toDeploymentBody() (+19 more)

### Community 14 - "package.json"
Cohesion: 0.12
Nodes (7): Route, Route, Route, Route, Route, Route, FileRoutesByPath

### Community 15 - "index.tsx"
Cohesion: 0.21
Nodes (13): isDuplicateKeyError(), BUILT_IN_VARIABLES, BuiltInVariable, checkDeployment(), DeploymentCheckResult, isBuiltIn(), renderTemplate(), scanTemplate() (+5 more)

### Community 16 - "index.tsx"
Cohesion: 0.25
Nodes (6): getRouter(), Register, @tanstack/react-router, Register, routeTree, startInstance

### Community 17 - "route.tsx"
Cohesion: 0.20
Nodes (18): customerFolders, hostPaths(), interpolate(), isInside(), isRecord(), isUnderDataRoot(), mountSources(), mountVariables() (+10 more)

### Community 19 - "index.ts"
Cohesion: 0.06
Nodes (65): publicFileUrl(), CheckDeploymentInDto, CheckDeploymentOutDto, CreateProductDto, PricingProductOutDto, ProductOutDto, ProductSummaryDto, UpdateProductDto (+57 more)

### Community 21 - "TopicModel"
Cohesion: 0.18
Nodes (8): DeploymentOutDto, DeploymentModel, RunAction, DeploymentRunModel, DeploymentDoc, DeploymentService, messageOf(), RunDoc

### Community 22 - "new.tsx"
Cohesion: 0.18
Nodes (14): AdminUserDetailOutDto, AdminUserOutDto, UpdateAdminUserDto, USER_ROLES, UserRole, userSchema, AppConfigPayload, AdminService (+6 more)

### Community 23 - "login.tsx"
Cohesion: 0.24
Nodes (7): credentialRateLimit, deploymentRateLimit, otpRateLimit, authController, router, deploymentController, router

### Community 24 - "widget.service.ts"
Cohesion: 0.18
Nodes (16): checkDockerCompose(), checkEnvFile(), closest(), closingBrace(), ComposeIssue, ComposeIssueSeverity, editDistance(), Entry (+8 more)

### Community 25 - "register.tsx"
Cohesion: 0.14
Nodes (21): ProductsAdminForm(), UserDetailForm(), UserPurchasesForm(), CheckoutButton(), ProductStatusBadge(), useProductAccess(), Detail(), State (+13 more)

### Community 26 - "Spline 3D"
Cohesion: 0.40
Nodes (4): brand(), escapeHtml(), layout(), MailService

### Community 27 - "purchase.service.ts"
Cohesion: 0.21
Nodes (9): readBearer(), requireAuth(), requireUser, basketController, router, paymentController, purchaseController, router (+1 more)

### Community 28 - "compilerOptions"
Cohesion: 0.07
Nodes (27): compilerOptions, allowImportingTsExtensions, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+19 more)

### Community 30 - "purchase.model.ts"
Cohesion: 0.12
Nodes (22): CheckoutLineOutDto, CheckoutOutDto, PaymentOutDto, CounterInterface, CounterModel, counterSchema, nextSequence(), PAYMENT_STATUSES (+14 more)

### Community 31 - "devDependencies"
Cohesion: 0.08
Nodes (25): eslint, devDependencies, eslint, prettier, @tailwindcss/typography, @tanstack/devtools-vite, @tanstack/eslint-config, @tanstack/router-cli (+17 more)

### Community 32 - "normalizeImage"
Cohesion: 0.21
Nodes (4): AppConfigInterface, AppConfigModel, appConfigSchema, AppConfigService

### Community 33 - "auth.service.test.ts"
Cohesion: 0.33
Nodes (4): cloudflareTunnelId(), isDevelopmentBuild(), jwtSecret(), required()

### Community 34 - "RolesAdminForm.tsx"
Cohesion: 0.13
Nodes (15): Stepper(), DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuRadioItem(), DropdownMenuSeparator(), DropdownMenuShortcut() (+7 more)

### Community 35 - "app-config.tsx"
Cohesion: 0.20
Nodes (4): mergeDuplicateItems(), Deps, PaymentService, PaymentStore

### Community 36 - "route.tsx"
Cohesion: 0.50
Nodes (4): AdminLayout(), breadcrumbFor(), NAV_ITEMS, Route

### Community 37 - "purchase.model.ts"
Cohesion: 0.09
Nodes (43): CHECK_TEXT, DeploymentRow(), DeploymentsAdminForm(), Field(), FilterKey, FILTERS, lastUpAt(), matches() (+35 more)

### Community 38 - "dependencies"
Cohesion: 0.08
Nodes (25): class-variance-authority, clsx, cmdk, cn, dependencies, class-variance-authority, clsx, cmdk (+17 more)

### Community 39 - "brandingContext.tsx"
Cohesion: 0.14
Nodes (16): DokployProjectOutDto, dokployUrl(), DokployController, containersOutcome, deploymentOutcome, DokployCompose, DokployEnvironment, DokployService (+8 more)

### Community 40 - "pricing.tsx"
Cohesion: 0.14
Nodes (20): AdminDeploymentRowOutDto, DeploymentActionInDto, DeploymentRunOutDto, DeploymentVariableOutDto, RunStepOutDto, ServiceStatusOutDto, UpdateDeploymentValuesInDto, DeploymentRunInterface (+12 more)

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
Cohesion: 0.14
Nodes (11): DokployProjectCombobox(), Command(), CommandEmpty(), CommandGroup(), CommandInput(), CommandItem(), CommandList(), Popover() (+3 more)

### Community 46 - "dependencies"
Cohesion: 0.08
Nodes (25): dependencies, bcrypt, cors, express, express-rate-limit, helmet, jsonwebtoken, mongoose (+17 more)

### Community 47 - "useAuth"
Cohesion: 0.24
Nodes (15): Bucket, buckets, deleteFile(), deleteFileIfExists(), findFile(), getBucket(), GridFsFileResult, openDownload() (+7 more)

### Community 48 - "ProfileForm.tsx"
Cohesion: 0.18
Nodes (18): ACTION_LABELS, allowedActions(), BUSY_STATES, mayBeRunning(), nextAllowedStart(), PIPELINES, shouldAutoTurnOff(), START_HISTORY_MS (+10 more)

### Community 49 - "auth.route.ts"
Cohesion: 0.13
Nodes (19): UsersAdminForm(), AuthContext, AuthContextValue, AuthProvider(), AuthUser, bootstrapAuth(), clearToken(), fetchValidatedUser() (+11 more)

### Community 50 - "$userId.tsx"
Cohesion: 0.22
Nodes (10): UserDeploymentsForm(), Tabs(), TabsContent(), TabsList(), tabsListVariants, TabsTrigger(), Route, UserTab (+2 more)

### Community 51 - "components.json"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 52 - "route.tsx"
Cohesion: 0.20
Nodes (12): connectDatabase(), bootstrap(), createApp(), format(), location(), logger, startLapsedSubscriptionSweep(), paymentController (+4 more)

### Community 53 - "devDependencies"
Cohesion: 0.08
Nodes (25): devDependencies, prettier, @tsconfig/node22, tsx, @types/bcrypt, @types/cors, @types/express, @types/jsonwebtoken (+17 more)

### Community 57 - "helmet"
Cohesion: 0.20
Nodes (16): CheckoutInDto, CheckoutItemInDto, CheckoutQuoteInDto, PaymentItemOutDto, BasketController, fail(), ok(), productIdParam() (+8 more)

### Community 58 - "mongoose"
Cohesion: 0.23
Nodes (6): ApiResponseDto, upload, AppConfigController, appConfigController, router, router

### Community 60 - ".toOut"
Cohesion: 0.56
Nodes (5): builtInsFor(), resetFoldersOf(), toRunOut(), valuesOf(), resolveDeployment()

### Community 61 - "deployment.controller.ts"
Cohesion: 0.08
Nodes (31): requireAdmin(), run(), uploadSingleImage(), adminController, deploymentController, dokployController, paymentController, productController (+23 more)

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
Cohesion: 0.15
Nodes (9): authenticateByToken(), AuthError, UserInterface, HASH, mailer, Express, Request, AccessTokenPayload (+1 more)

### Community 66 - "popover.tsx"
Cohesion: 0.67
Nodes (3): Phase, SnapEmbed(), loadSnap()

### Community 67 - "appConfig.controller.ts"
Cohesion: 0.27
Nodes (8): CheckoutQuoteOutDto, BasketInterface, BasketItem, basketItemSchema, BasketModel, basketSchema, BasketService, clampQuantity()

### Community 69 - "@getbrevo/brevo"
Cohesion: 0.29
Nodes (13): UserModel, buildInvoicePdf(), C, formatDate(), formatDateTime(), formatIdr(), InvoicePdfInput, statusBadge() (+5 more)

### Community 72 - "tsconfig.json"
Cohesion: 0.22
Nodes (8): compilerOptions, forceConsistentCasingInFileNames, outDir, rootDir, extends, include, src/**/*.ts, @tsconfig/node22/tsconfig.json

### Community 76 - "register.tsx"
Cohesion: 0.15
Nodes (14): PaymentConfigOutDto, PaymentListOutDto, env, fail(), PaymentController, sendPdf(), statusOf(), withUser() (+6 more)

### Community 78 - "purchase.model.ts"
Cohesion: 0.14
Nodes (14): Footer(), FOOTER_COLUMNS, FooterLink, DeployConsole(), STEPS, FinalCta(), bootstrapBranding(), Branding (+6 more)

### Community 82 - "Header.tsx"
Cohesion: 0.25
Nodes (7): ADMIN_LINK, DASHBOARD_LINK, Header(), HOME_LINK, NavLink, PRICING_LINK, useBasketCount()

### Community 85 - "index.tsx"
Cohesion: 0.50
Nodes (3): BillingHistory(), State, PaymentList

### Community 86 - "index.tsx"
Cohesion: 0.25
Nodes (7): CheckoutForm(), CheckoutLineRow(), ItemsTable(), formatIdr(), periodLabel(), CheckoutSearch, Route

### Community 89 - "router.tsx"
Cohesion: 0.15
Nodes (14): LoginInDto, LoginOutDto, RegisterInDto, RegisterOutDto, ResetPasswordInDto, ResetPasswordOutDto, SendOtpInDto, AuthService (+6 more)

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
Nodes (22): AppConfigData, ToggleRow(), LoginForm(), LoginResponse, RegisterForm(), RegisterResponse, readOnlyInputClassName, ResetPasswordForm() (+14 more)

### Community 110 - "ListPagination.tsx"
Cohesion: 0.14
Nodes (20): UserPatch, State, EndChoice, Mode, Scheduled, Props, Button(), buttonVariants (+12 more)

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
- **369 isolated node(s):** `name`, `version`, `description`, `dev`, `start` (+364 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **25 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `run()` connect `deployment.controller.ts` to `.toOut`, `TopicModel`?**
  _High betweenness centrality (0.234) - this node is a cross-community bridge._
- **Why does `ProductsPlansForm()` connect `deployment.controller.ts` to `apiKeyValidation.ts`, `$userId.tsx`, `SandboxChatForm.tsx`?**
  _High betweenness centrality (0.233) - this node is a cross-community bridge._
- **Why does `apiFetch()` connect `SandboxChatForm.tsx` to `mcp.service.ts`, `index.ts`, `purchase.model.ts`, `apiKeyValidation.ts`, `@types/cors`, `app-config.tsx`, `ListPagination.tsx`, `purchase.model.ts`, `auth.route.ts`, `index.tsx`, `register.tsx`, `deployment.controller.ts`?**
  _High betweenness centrality (0.166) - this node is a cross-community bridge._
- **What connects `name`, `version`, `description` to the rest of the system?**
  _369 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `parseApiKeyId` be split into smaller, more focused modules?**
  _Cohesion score 0.102322206095791 - nodes in this community are weakly interconnected._
- **Should `utils.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0782051282051282 - nodes in this community are weakly interconnected._
- **Should `index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._