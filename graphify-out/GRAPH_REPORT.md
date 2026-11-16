# Graph Report - fedier  (2026-11-15)

## Corpus Check
- 313 files · ~168,142 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2179 nodes · 5712 edges · 111 communities (90 shown, 21 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 65 edges (avg confidence: 0.57)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `66e2852b`
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
- parseRouteId
- userProduct.planner.ts
- Header.tsx
- ticketImage.ts
- run
- index.tsx
- index.tsx
- index.tsx
- $productId.tsx
- router.tsx
- route.tsx
- $paymentId.tsx
- multer
- remark-gfm
- Fedier template
- @types/qrcode
- @tanstack/react-router
- @tanstack/react-start
- SITE_NAME
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
1. `cn()` - 99 edges
2. `UserModel` - 49 edges
3. `apiFetch()` - 47 edges
4. `Button()` - 43 edges
5. `DeploymentService` - 40 edges
6. `FileRoutesByPath` - 36 edges
7. `parseRouteId()` - 35 edges
8. `ProductModel` - 30 edges
9. `useAuth()` - 30 edges
10. `TicketService` - 28 edges

## Surprising Connections (you probably didn't know these)
- `ProductsPlansForm()` --indirect_call--> `run()`  [INFERRED]
  frontend/src/components/forms/profile/ProductsPlansForm.tsx → backend/src/middleware/requireAdmin.test.ts
- `CreateInvoiceDialog()` --indirect_call--> `line()`  [INFERRED]
  frontend/src/components/forms/admin/CreateInvoiceDialog.tsx → backend/src/validation/contact.ts
- `CheckoutForm()` --indirect_call--> `line()`  [INFERRED]
  frontend/src/components/forms/billing/CheckoutForm.tsx → backend/src/validation/contact.ts
- `mountSources()` --indirect_call--> `service()`  [INFERRED]
  backend/src/utils/deploymentFolders.ts → backend/src/modules/llm/llm.service.test.ts
- `UserProductsForm()` --indirect_call--> `period()`  [INFERRED]
  frontend/src/components/forms/admin/UserProductsForm.tsx → backend/src/modules/userProduct/userProduct.planner.test.ts

## Import Cycles
- None detected.

## Communities (111 total, 21 thin omitted)

### Community 0 - "mcp.service.ts"
Cohesion: 0.06
Nodes (56): Filter, State, CheckoutLineRow(), State, InvoiceDetail(), ItemsTable(), metaLine(), paidWith() (+48 more)

### Community 1 - "parseApiKeyId"
Cohesion: 0.10
Nodes (30): ProductSummaryDto, AssignProductDto, PeriodEndSpec, ProductPeriodOutDto, UserPlanOutDto, UserProductRowOutDto, PRODUCT_PERIOD_SOURCES, ProductPeriodSource (+22 more)

### Community 2 - "utils.ts"
Cohesion: 0.07
Nodes (24): formatInvoiceNumber(), FetchLike, itemName(), MidtransConfig, MidtransNotification, MidtransProvider, midtransStatus(), allowAllProvider (+16 more)

### Community 3 - "index.ts"
Cohesion: 0.05
Nodes (49): EmailDelivery, InAppDelivery, NotificationOutDto, NotificationPageOutDto, ReadAllOutDto, SendNotificationInDto, SendNotificationResult, UnreadCountOutDto (+41 more)

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
Cohesion: 0.04
Nodes (53): getRouter(), Register, @tanstack/react-router, Route, AdminAppConfigRoute, AdminDeploymentsRoute, AdminIndexRoute, AdminProductsIndexRoute (+45 more)

### Community 9 - "SandboxOcrForm.tsx"
Cohesion: 0.40
Nodes (4): Boundaries, Examples, Format, Scoring

### Community 10 - "apiKeyValidation.ts"
Cohesion: 0.16
Nodes (19): period(), UserProductsForm(), ProductsPlansForm(), ClosureCard(), chartWindow(), describePeriod(), joins(), percent() (+11 more)

### Community 11 - "ProjectSidebar.tsx"
Cohesion: 0.50
Nodes (3): Boundaries, Output, Scan

### Community 12 - "widget.dto.ts"
Cohesion: 0.15
Nodes (6): ServicesPage(), seo(), Route, Route, Route, Route

### Community 13 - "app-config.tsx"
Cohesion: 0.07
Nodes (43): checkDeployment(), DeploymentDraft, DeploymentFields(), EMPTY_DEPLOYMENT, fieldElementId(), focusField(), IssueRow(), toDeploymentBody() (+35 more)

### Community 14 - "package.json"
Cohesion: 0.05
Nodes (29): LinkTag, MetaTag, privatePage(), SeoInput, SITE_URL, Route, Route, Route (+21 more)

### Community 15 - "index.tsx"
Cohesion: 0.17
Nodes (17): CloseTicketOutDto, TicketClosureOutDto, TicketErrorDataDto, TicketMessageOutDto, TicketSummaryOutDto, TICKET_STATUSES, TicketInterface, TicketStatus (+9 more)

### Community 16 - "index.tsx"
Cohesion: 0.12
Nodes (38): DEPLOYMENT_TYPES, DeploymentDomain, DeploymentType, DeploymentVariable, NOTICE_TONES, NoticeTone, PRODUCT_KINDS, ProductInterface (+30 more)

### Community 17 - "route.tsx"
Cohesion: 0.21
Nodes (18): customerFolders, hostPaths(), interpolate(), isInside(), isRecord(), isUnderDataRoot(), mountSources(), mountVariables() (+10 more)

### Community 18 - "scan.ts"
Cohesion: 0.20
Nodes (8): TicketOutDto, TicketPageOutDto, TicketModel, TicketMessageModel, messageOf(), notFound(), remaining(), TicketService

### Community 19 - "index.ts"
Cohesion: 0.13
Nodes (23): publicFileUrl(), CheckDeploymentInDto, CheckDeploymentOutDto, CreateProductDto, PricingProductOutDto, ProductOutDto, UpdateProductDto, ProductDeployment (+15 more)

### Community 20 - "Stitch to Remotion Walkthrough Videos"
Cohesion: 0.21
Nodes (16): fail(), ok(), TicketController, ticketIdOf(), validate(), ValidationError, cleanBody(), cleanSubject() (+8 more)

### Community 21 - "TopicModel"
Cohesion: 0.14
Nodes (10): AdminDeploymentRowOutDto, DeploymentOutDto, DeploymentModel, RunAction, DeploymentRunModel, DeploymentDoc, DeploymentService, isDuplicateKeyError() (+2 more)

### Community 22 - "new.tsx"
Cohesion: 0.15
Nodes (18): AdminUserDetailOutDto, AdminUserOutDto, CreateAdminUserDto, UpdateAdminUserDto, USER_ROLES, UserRole, AppConfigPayload, AdminService (+10 more)

### Community 23 - "login.tsx"
Cohesion: 0.24
Nodes (7): credentialRateLimit, deploymentRateLimit, otpRateLimit, authController, router, deploymentController, router

### Community 24 - "widget.service.ts"
Cohesion: 0.12
Nodes (27): BUILT_IN_VARIABLES, BuiltInVariable, checkDeployment(), DeploymentCheckResult, isBuiltIn(), renderTemplate(), scanTemplate(), GOOD (+19 more)

### Community 25 - "register.tsx"
Cohesion: 0.27
Nodes (6): AuthError, readBearer(), requireAuth(), requireUser, basketController, router

### Community 26 - "Spline 3D"
Cohesion: 0.20
Nodes (8): HASH, brand(), color, escapeHtml(), layout(), logo, mailer, MailService

### Community 27 - "purchase.service.ts"
Cohesion: 0.29
Nodes (8): CounterInterface, CounterModel, counterSchema, nextSequence(), PaymentModel, LegacyPayment, startPaymentSweep(), setAfterGrant()

### Community 28 - "compilerOptions"
Cohesion: 0.07
Nodes (27): compilerOptions, allowImportingTsExtensions, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+19 more)

### Community 29 - "AuthController"
Cohesion: 0.16
Nodes (7): AuthController, googleCode(), normalizeEmail(), googleOAuth, GoogleProfile, ISSUERS, readIdToken()

### Community 30 - "purchase.model.ts"
Cohesion: 0.17
Nodes (11): CheckoutInDto, CheckoutItemInDto, lineAmount(), maxQuantity(), mergeDuplicateItems(), totalAmount(), InvoiceLine, paymentProvider (+3 more)

### Community 31 - "devDependencies"
Cohesion: 0.08
Nodes (25): eslint, devDependencies, eslint, prettier, @tailwindcss/typography, @tanstack/devtools-vite, @tanstack/eslint-config, @tanstack/router-cli (+17 more)

### Community 32 - "normalizeImage"
Cohesion: 0.17
Nodes (8): AppConfigInterface, ContactDetails, EMPTY_CONTACT, AppConfigModel, appConfigSchema, contactSchema, userSchema, AppConfigService

### Community 33 - "auth.service.test.ts"
Cohesion: 0.11
Nodes (13): FinalCta(), ASSURANCES, HeroSection(), ACTIVITY, HeroVisual(), NAV, PIPELINE, STATS (+5 more)

### Community 34 - "RolesAdminForm.tsx"
Cohesion: 0.07
Nodes (45): Footer(), AppConfigForm(), DokployProjectCombobox(), Stepper(), CheckoutButton(), ProductStatusBadge(), useProductAccess(), Detail() (+37 more)

### Community 35 - "app-config.tsx"
Cohesion: 0.17
Nodes (8): AdminInvoiceInDto, CheckoutOutDto, PaymentOutDto, PaymentSource, PaymentStatus, Deps, PaymentService, PaymentStore

### Community 36 - "route.tsx"
Cohesion: 0.16
Nodes (14): FOOTER_COLUMNS, FooterLink, PricingGrid(), ServiceAction(), ServiceCard(), ServiceIcon(), ServiceLogo(), Action (+6 more)

### Community 37 - "purchase.model.ts"
Cohesion: 0.07
Nodes (47): CHECK_TEXT, DeploymentRow(), DeploymentsAdminForm(), Field(), FilterKey, FILTERS, lastUpAt(), matches() (+39 more)

### Community 38 - "dependencies"
Cohesion: 0.08
Nodes (25): class-variance-authority, cmdk, cn, dependencies, class-variance-authority, cmdk, cn, @gsap/react (+17 more)

### Community 39 - "brandingContext.tsx"
Cohesion: 0.09
Nodes (24): DokployProjectOutDto, cloudflareTunnelId(), dokployUrl(), isDevelopmentBuild(), isLocalHost(), jwtSecret(), mediaSigningSecret(), midtransNotificationUrl() (+16 more)

### Community 40 - "pricing.tsx"
Cohesion: 0.13
Nodes (22): DeploymentActionInDto, DeploymentRunOutDto, DeploymentSyncDomainOutDto, DeploymentSyncItemOutDto, DeploymentSyncOutDto, DeploymentVariableOutDto, RunStepOutDto, UpdateDeploymentValuesInDto (+14 more)

### Community 41 - "$productId.tsx"
Cohesion: 0.18
Nodes (5): AdminController, asRecord(), block(), line(), parseContactDetails()

### Community 42 - "route.tsx"
Cohesion: 0.18
Nodes (11): ServiceBeatOutDto, ServiceCheckState, isRecord(), Json, messageOf(), monitorPayload(), MonitorStatus, STATES (+3 more)

### Community 43 - "pricing.tsx"
Cohesion: 0.26
Nodes (7): CloudflareService, DnsRecord, IngressRule, isRecord(), Json, withoutRoute(), withRoute()

### Community 44 - "multer"
Cohesion: 0.60
Nodes (3): ALLOWED_FORMATS, NormalizedImage, normalizeImage()

### Community 45 - "@types/cors"
Cohesion: 0.12
Nodes (25): TicketsAdminForm(), CloseTicketDialog(), SupportForm(), EditableStatus(), TicketDetail(), CharCount(), ImagePicker(), MessageComposer() (+17 more)

### Community 46 - "dependencies"
Cohesion: 0.08
Nodes (25): dependencies, bcrypt, cors, express, express-rate-limit, jsonwebtoken, mongoose, multer (+17 more)

### Community 47 - "useAuth"
Cohesion: 0.21
Nodes (19): Bucket, buckets, deleteFile(), deleteFileIfExists(), findFile(), getBucket(), GridFsFileResult, openDownload() (+11 more)

### Community 48 - "ProfileForm.tsx"
Cohesion: 0.15
Nodes (23): ACTION_LABELS, ActualContainers, allowedActions(), BUSY_STATES, DomainCheck, domainIssue(), mayBeRunning(), nextAllowedStart() (+15 more)

### Community 49 - "auth.route.ts"
Cohesion: 0.18
Nodes (15): AuthContext, AuthContextValue, AuthProvider(), AuthUser, bootstrapAuth(), clearToken(), fetchValidatedUser(), invalidateAuthCache() (+7 more)

### Community 50 - "$userId.tsx"
Cohesion: 0.23
Nodes (9): UserDeploymentsForm(), BillingHistory(), Tabs(), TabsContent(), TabsList(), tabsListVariants, TabsTrigger(), UserTab (+1 more)

### Community 51 - "components.json"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 52 - "route.tsx"
Cohesion: 0.19
Nodes (13): connectDatabase(), bootstrap(), createApp(), format(), location(), logger, startLapsedSubscriptionSweep(), router (+5 more)

### Community 53 - "devDependencies"
Cohesion: 0.08
Nodes (25): devDependencies, mongodb-memory-server, prettier, @tsconfig/node22, tsx, @types/bcrypt, @types/cors, @types/jsonwebtoken (+17 more)

### Community 54 - "UsersAdminForm.tsx"
Cohesion: 0.11
Nodes (13): contentOf(), LLM_ERROR_CODES, LlmChatInput, LlmClient, LlmError, LlmErrorCode, LlmMessage, LlmRole (+5 more)

### Community 55 - "index.tsx"
Cohesion: 0.13
Nodes (14): router, busyTicket(), kinds(), makeProduct(), makeUser(), png(), Reply, Sent (+6 more)

### Community 56 - "$productId.tsx"
Cohesion: 0.17
Nodes (21): badgeText(), NotificationMenu(), DropdownMenu(), AppNotification, EMPTY, formatRelativeTime(), isSafeInternalLink(), listeners (+13 more)

### Community 57 - "helmet"
Cohesion: 0.23
Nodes (16): BasketController, fail(), ok(), productIdParam(), asRecord(), parseAdminInvoiceInDto(), parseBasketAddInDto(), parseBasketQuantityInDto() (+8 more)

### Community 58 - "mongoose"
Cohesion: 0.19
Nodes (7): ApiResponseDto, uploadSingleImage(), AppConfigController, appConfigController, router, router, ticketController

### Community 60 - ".toOut"
Cohesion: 0.33
Nodes (7): ServiceStatusOutDto, builtInsFor(), resetFoldersOf(), toRunOut(), valuesOf(), resolveDeployment(), usernameFromEmail()

### Community 61 - "deployment.controller.ts"
Cohesion: 0.29
Nodes (8): DeploymentController, fail(), ok(), productIdOf(), target(), DeploymentBusyError, DeploymentLimitError, DeploymentView

### Community 62 - "deployment.model.ts"
Cohesion: 0.27
Nodes (9): DEPLOYMENT_STATES, DeploymentInterface, DeploymentMonitor, DeploymentValue, DokployLink, deploymentSchema, dokploySchema, monitorSchema (+1 more)

### Community 63 - "package.json"
Cohesion: 0.22
Nodes (8): imports, name, pnpm, onlyBuiltDependencies, private, type, esbuild, lightningcss

### Community 64 - "scripts"
Cohesion: 0.22
Nodes (9): scripts, build, check, dev, format, generate-routes, lint, preview (+1 more)

### Community 65 - "purchase.model.ts"
Cohesion: 0.27
Nodes (7): env, authenticateByToken(), UserInterface, Express, Request, AccessTokenPayload, verifyAccessToken()

### Community 66 - "popover.tsx"
Cohesion: 0.17
Nodes (14): AdminInvoiceLineInDto, CheckoutLineOutDto, CheckoutQuoteInDto, PaymentConfigOutDto, PaymentItemOutDto, PaymentListOutDto, PAYMENT_ITEM_KINDS, PAYMENT_SOURCES (+6 more)

### Community 67 - "appConfig.controller.ts"
Cohesion: 0.27
Nodes (8): CheckoutQuoteOutDto, BasketInterface, BasketItem, basketItemSchema, BasketModel, basketSchema, BasketService, clampQuantity()

### Community 68 - "route.tsx"
Cohesion: 0.18
Nodes (10): GrantPurchaseInDto, PurchaseOutDto, PURCHASE_SOURCES, PurchaseInterface, PurchaseSource, PurchaseModel, purchaseSchema, AlreadyOwnedError (+2 more)

### Community 69 - "@getbrevo/brevo"
Cohesion: 0.26
Nodes (15): buildInvoicePdf(), C, formatDate(), formatDateTime(), formatIdr(), InvoicePdfInput, statusBadge(), emailItems() (+7 more)

### Community 70 - "lucide-react"
Cohesion: 0.07
Nodes (25): findTicketFile(), alreadyClosed(), imagePath(), IncomingImage, isUnread(), MessageDoc, Photo, send() (+17 more)

### Community 72 - "tsconfig.json"
Cohesion: 0.22
Nodes (8): compilerOptions, forceConsistentCasingInFileNames, outDir, rootDir, extends, include, src/**/*.ts, @tsconfig/node22/tsconfig.json

### Community 74 - "react-hot-toast"
Cohesion: 0.12
Nodes (8): absoluteUrl(), jsonLd(), Route, DISALLOW, Route, Entry, Route, STATIC_PAGES

### Community 75 - "tailwindcss"
Cohesion: 0.22
Nodes (8): adminController, deploymentController, dokployController, paymentController, productController, purchaseController, ticketController, userProductController

### Community 76 - "register.tsx"
Cohesion: 0.22
Nodes (8): fail(), PaymentController, sendPdf(), statusOf(), withUser(), listPayments(), toPaymentOut(), parsePageQuery()

### Community 77 - "$productId.tsx"
Cohesion: 0.37
Nodes (3): fail(), ok(), ProductController

### Community 78 - "purchase.model.ts"
Cohesion: 0.17
Nodes (11): bootstrapBranding(), Branding, BrandingContext, BrandingContextValue, BrandingProvider(), fetchBranding(), invalidateBrandingCache(), ORGANIZATION_LD (+3 more)

### Community 80 - "parseRouteId"
Cohesion: 0.19
Nodes (12): fail(), ok(), PurchaseController, fail(), ok(), UserProductController, paymentController, purchaseController (+4 more)

### Community 81 - "userProduct.planner.ts"
Cohesion: 0.33
Nodes (3): GoogleCallback(), GoogleCallbackSearch, Route

### Community 82 - "Header.tsx"
Cohesion: 0.22
Nodes (8): background_color, description, display, icons, name, short_name, start_url, theme_color

### Community 89 - "router.tsx"
Cohesion: 0.14
Nodes (18): GoogleConfigOutDto, GoogleSignInInDto, GoogleSignInOutDto, LoginInDto, LoginOutDto, RegisterInDto, RegisterOutDto, ResetPasswordInDto (+10 more)

### Community 94 - "Fedier template"
Cohesion: 0.14
Nodes (12): Frontend, Closing a ticket (with an optional AI summary), Commands, Contact page and support tickets, Environment, Fedier template, Layout, Notifications (+4 more)

### Community 101 - "package.json"
Cohesion: 0.25
Nodes (7): author, description, keywords, license, name, type, version

### Community 102 - "scripts"
Cohesion: 0.25
Nodes (8): scripts, build, dev, format, format:check, start, test, type-check

### Community 103 - "SandboxChatForm.tsx"
Cohesion: 0.07
Nodes (41): AppConfigData, CONTACT_FIELDS, ToggleRow(), UserDetailForm(), UserPurchasesForm(), GoogleButton(), GoogleMark(), LoginForm() (+33 more)

### Community 110 - "ListPagination.tsx"
Cohesion: 0.09
Nodes (30): CreateInvoiceDialog(), InvoiceLineEditor(), Line, lineTotal(), maxQuantity(), toWhole(), ProductsAdminForm(), State (+22 more)

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
- **456 isolated node(s):** `name`, `version`, `description`, `dev`, `start` (+451 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **21 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `run()` connect `run` to `apiKeyValidation.ts`, `.toOut`, `TopicModel`?**
  _High betweenness centrality (0.141) - this node is a cross-community bridge._
- **Why does `ProductsPlansForm()` connect `apiKeyValidation.ts` to `$userId.tsx`, `run`, `SandboxChatForm.tsx`?**
  _High betweenness centrality (0.140) - this node is a cross-community bridge._
- **Why does `apiFetch()` connect `SandboxChatForm.tsx` to `mcp.service.ts`, `RolesAdminForm.tsx`, `purchase.model.ts`, `apiKeyValidation.ts`, `react-hot-toast`, `app-config.tsx`, `ListPagination.tsx`, `@types/cors`, `purchase.model.ts`, `$productId.tsx`?**
  _High betweenness centrality (0.125) - this node is a cross-community bridge._
- **What connects `name`, `version`, `description` to the rest of the system?**
  _456 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `mcp.service.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.062206572769953054 - nodes in this community are weakly interconnected._
- **Should `parseApiKeyId` be split into smaller, more focused modules?**
  _Cohesion score 0.10304789550072568 - nodes in this community are weakly interconnected._
- **Should `utils.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06976744186046512 - nodes in this community are weakly interconnected._