# Graph Report - fedier  (2026-11-19)

## Corpus Check
- 364 files · ~225,237 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2440 nodes · 6543 edges · 126 communities (104 shown, 22 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 75 edges (avg confidence: 0.58)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c0856977`
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
- config.ts
- AdminService
- package.json
- scripts
- SandboxChatForm.tsx
- apiResponse.dto.ts
- .sendOtp
- PurchaseController
- deploymentCommand.ts
- deployment.readiness.ts
- n8n hosting product
- ListPagination.tsx
- sitemap[.]xml.ts
- ticket.route.ts
- UserInterface
- reset-password.tsx
- yaml
- tsconfig.build.json
- ticketImage.ts
- app-config.tsx
- SideDrawer.tsx
- prettier.config.js
- vite.config.ts
- CLAUDE.md
- AGENTS.md

## God Nodes (most connected - your core abstractions)
1. `cn()` - 127 edges
2. `apiFetch()` - 56 edges
3. `UserModel` - 53 edges
4. `Button()` - 51 edges
5. `DeploymentService` - 46 edges
6. `FileRoutesByPath` - 40 edges
7. `parseRouteId()` - 39 edges
8. `ProductModel` - 36 edges
9. `useAuth()` - 34 edges
10. `formatDateTime()` - 34 edges

## Surprising Connections (you probably didn't know these)
- `DeploymentPanel()` --indirect_call--> `run()`  [INFERRED]
  frontend/src/components/forms/deployment/DeploymentPanel.tsx → backend/src/middleware/requireAdmin.test.ts
- `ProductsPlansForm()` --indirect_call--> `run()`  [INFERRED]
  frontend/src/components/forms/profile/ProductsPlansForm.tsx → backend/src/middleware/requireAdmin.test.ts
- `playScene()` --indirect_call--> `after()`  [INFERRED]
  frontend/src/components/home/HeroVisual.tsx → backend/src/modules/notification/notification.service.ts
- `playScene()` --indirect_call--> `at()`  [INFERRED]
  frontend/src/components/home/HeroVisual.tsx → backend/src/modules/userProduct/userProduct.planner.test.ts
- `CreateInvoiceDialog()` --indirect_call--> `line()`  [INFERRED]
  frontend/src/components/forms/admin/CreateInvoiceDialog.tsx → backend/src/validation/contact.ts

## Import Cycles
- None detected.

## Communities (126 total, 22 thin omitted)

### Community 0 - "mcp.service.ts"
Cohesion: 0.07
Nodes (55): State, Filter, CheckoutForm(), CheckoutLineRow(), State, InvoiceDetail(), ItemsTable(), metaLine() (+47 more)

### Community 1 - "parseApiKeyId"
Cohesion: 0.05
Nodes (60): CreateRedeemCodesInDto, REDEEM_CODE_GROUPS, RedeemCodeGroup, RedeemCodeListOutDto, RedeemCodeOutDto, RedeemCodeUserDto, RedeemResultOutDto, AssignProductDto (+52 more)

### Community 2 - "utils.ts"
Cohesion: 0.07
Nodes (23): formatInvoiceNumber(), FetchLike, itemName(), MidtransConfig, MidtransNotification, MidtransProvider, midtransStatus(), allowAllProvider (+15 more)

### Community 3 - "index.ts"
Cohesion: 0.12
Nodes (17): EmailDelivery, InAppDelivery, NotificationOutDto, NotificationPageOutDto, ReadAllOutDto, UnreadCountOutDto, NOTIFICATION_CHANNELS, NotificationInterface (+9 more)

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
Cohesion: 0.03
Nodes (60): getRouter(), Register, @tanstack/react-router, Route, Route, Route, AdminAppConfigRoute, AdminDeploymentsRoute (+52 more)

### Community 9 - "SandboxOcrForm.tsx"
Cohesion: 0.40
Nodes (4): Boundaries, Examples, Format, Scoring

### Community 10 - "apiKeyValidation.ts"
Cohesion: 0.14
Nodes (21): DashboardTours(), openMobileMenu(), PROFILE_TARGETS, welcomeSteps(), fireConfetti(), palette(), Piece, findTarget() (+13 more)

### Community 11 - "ProjectSidebar.tsx"
Cohesion: 0.50
Nodes (3): Boundaries, Output, Scan

### Community 12 - "widget.dto.ts"
Cohesion: 0.43
Nodes (5): ContactDetailsView(), Row, rowsOf(), ContactDetails, EMPTY_CONTACT

### Community 13 - "app-config.tsx"
Cohesion: 0.07
Nodes (38): checkDeployment(), DeploymentDraft, DeploymentFields(), EMPTY_DEPLOYMENT, fieldElementId(), focusField(), IssueRow(), toDeploymentBody() (+30 more)

### Community 14 - "package.json"
Cohesion: 0.04
Nodes (29): privatePage(), Route, Route, Route, Route, Route, Route, Route (+21 more)

### Community 15 - "index.tsx"
Cohesion: 0.18
Nodes (20): CloseTicketOutDto, TicketClosureOutDto, TicketErrorDataDto, TicketMessageOutDto, TicketOutDto, TicketPageOutDto, TicketSummaryOutDto, SenderRole (+12 more)

### Community 16 - "index.tsx"
Cohesion: 0.11
Nodes (41): DEPLOYMENT_TYPES, DeploymentDomain, DeploymentType, DeploymentVariable, NOTICE_TONES, NoticeTone, PRODUCT_KINDS, ProductInterface (+33 more)

### Community 17 - "route.tsx"
Cohesion: 0.20
Nodes (18): customerFolders, hostPaths(), interpolate(), isInside(), isRecord(), isUnderDataRoot(), mountSources(), mountVariables() (+10 more)

### Community 18 - "scan.ts"
Cohesion: 0.14
Nodes (13): TicketStatus, TicketModel, TicketMessageModel, kinds(), alreadyClosed(), imagePath(), isUnread(), messageOf() (+5 more)

### Community 19 - "index.ts"
Cohesion: 0.14
Nodes (18): deletePublicFile(), publicFileUrl(), ProductImageOutDto, ProductOutDto, UpdateProductDto, coverUrl(), imagesOf(), isDuplicateKeyError() (+10 more)

### Community 20 - "Stitch to Remotion Walkthrough Videos"
Cohesion: 0.37
Nodes (5): fail(), ok(), TicketController, ticketIdOf(), validate()

### Community 21 - "TopicModel"
Cohesion: 0.14
Nodes (10): DeploymentOutDto, run(), DeploymentModel, DeploymentRunModel, DeploymentCommand, ProductModel, DeploymentDoc, DeploymentService (+2 more)

### Community 22 - "new.tsx"
Cohesion: 0.16
Nodes (18): AdminUserDetailOutDto, AdminUserOutDto, CreateAdminUserDto, UpdateAdminUserDto, USER_ROLES, UserRole, AppConfigPayload, AdminService (+10 more)

### Community 23 - "login.tsx"
Cohesion: 0.12
Nodes (16): AuthError, credentialRateLimit, deploymentRateLimit, otpRateLimit, redeemRateLimit, readBearer(), requireAuth(), requireUser (+8 more)

### Community 24 - "widget.service.ts"
Cohesion: 0.18
Nodes (16): checkDockerCompose(), checkEnvFile(), closest(), closingBrace(), ComposeIssue, ComposeIssueSeverity, editDistance(), Entry (+8 more)

### Community 25 - "register.tsx"
Cohesion: 0.16
Nodes (17): RedeemCodesAdminForm(), State, STATUS_CLASS, STATUS_LABEL, RedeemCodeForm(), formatRedeemInput(), localInputToIso(), REDEEM_CODE_GROUPS (+9 more)

### Community 26 - "Spline 3D"
Cohesion: 0.30
Nodes (6): brand(), color, escapeHtml(), layout(), logo, MailService

### Community 27 - "purchase.service.ts"
Cohesion: 0.10
Nodes (19): actionLabel(), AdminDeploymentRow, BULK_ACTION_LABELS, BulkAction, dateFormatter, DeploymentBulk, DeploymentBulkItem, DeploymentCommand (+11 more)

### Community 28 - "compilerOptions"
Cohesion: 0.07
Nodes (27): compilerOptions, allowImportingTsExtensions, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+19 more)

### Community 29 - "AuthController"
Cohesion: 0.23
Nodes (3): AuthController, googleCode(), normalizeEmail()

### Community 30 - "purchase.model.ts"
Cohesion: 0.20
Nodes (16): CheckoutButton(), ProductStatusBadge(), useProductAccess(), Detail(), State, ProductGallery(), ProductImage(), GROUPS (+8 more)

### Community 31 - "devDependencies"
Cohesion: 0.08
Nodes (25): eslint, devDependencies, eslint, prettier, @tailwindcss/typography, @tanstack/devtools-vite, @tanstack/eslint-config, @tanstack/router-cli (+17 more)

### Community 32 - "normalizeImage"
Cohesion: 0.13
Nodes (10): AppConfigInterface, ContactDetails, EMPTY_CONTACT, AppConfigModel, appConfigSchema, contactSchema, AppConfigController, appConfigController (+2 more)

### Community 33 - "auth.service.test.ts"
Cohesion: 0.07
Nodes (26): at(), FinalCta(), ASSURANCES, HeroSection(), BACKUPS, CHAT, ChatbotScene(), DashboardScene() (+18 more)

### Community 34 - "RolesAdminForm.tsx"
Cohesion: 0.06
Nodes (47): AppConfigData, CONTACT_FIELDS, ToggleRow(), BulkDeploymentActions(), BulkResult(), GoogleButton(), RegisterForm(), RegisterResponse (+39 more)

### Community 35 - "app-config.tsx"
Cohesion: 0.15
Nodes (9): CheckoutItemInDto, CheckoutOutDto, PaymentOutDto, PaymentSource, PaymentStatus, mergeDuplicateItems(), Deps, PaymentService (+1 more)

### Community 36 - "route.tsx"
Cohesion: 0.16
Nodes (15): Footer(), FOOTER_COLUMNS, FooterLink, AppConfigForm(), ServiceAction(), ServiceCard(), ServiceIcon(), ServiceLogo() (+7 more)

### Community 37 - "purchase.model.ts"
Cohesion: 0.19
Nodes (18): CHECK_TEXT, DeploymentRow(), DeploymentsAdminForm(), Field(), FilterKey, FILTERS, lastUpAt(), matches() (+10 more)

### Community 38 - "dependencies"
Cohesion: 0.08
Nodes (25): class-variance-authority, cmdk, cn, dependencies, class-variance-authority, cmdk, cn, @gsap/react (+17 more)

### Community 39 - "brandingContext.tsx"
Cohesion: 0.08
Nodes (25): DokployProjectOutDto, cloudflareTunnelId(), dokployUrl(), isDevelopmentBuild(), isLocalHost(), jwtSecret(), mediaSigningSecret(), midtransNotificationUrl() (+17 more)

### Community 40 - "pricing.tsx"
Cohesion: 0.11
Nodes (29): DeploymentActionInDto, DeploymentBulkInDto, DeploymentBulkItemOutDto, DeploymentCommandOutDto, DeploymentRunOutDto, DeploymentSyncDomainOutDto, DeploymentSyncItemOutDto, DeploymentVariableOutDto (+21 more)

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
Cohesion: 0.07
Nodes (40): DokployProjectCombobox(), UserCell(), TicketsAdminForm(), CloseTicketDialog(), ProductPicker(), SupportForm(), EditableStatus(), TicketDetail() (+32 more)

### Community 46 - "dependencies"
Cohesion: 0.08
Nodes (25): dependencies, bcrypt, cors, express, express-rate-limit, jsonwebtoken, mongoose, multer (+17 more)

### Community 47 - "useAuth"
Cohesion: 0.20
Nodes (19): Bucket, buckets, deleteFile(), deleteFileIfExists(), findFile(), getBucket(), GridFsFileResult, openDownload() (+11 more)

### Community 48 - "ProfileForm.tsx"
Cohesion: 0.14
Nodes (25): ACTION_LABELS, ActualContainers, allowedActions(), bulkPlan(), BUSY_STATES, commandBlocker(), DomainCheck, domainIssue() (+17 more)

### Community 49 - "auth.route.ts"
Cohesion: 0.11
Nodes (24): PaymentsAdminForm(), UserPatch, UsersAdminForm(), AuthContext, AuthContextValue, AuthProvider(), AuthUser, bootstrapAuth() (+16 more)

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
Cohesion: 0.15
Nodes (12): busyTicket(), makeProduct(), makeUser(), png(), Reply, Sent, buildSummaryPrompt(), chars() (+4 more)

### Community 56 - "$productId.tsx"
Cohesion: 0.16
Nodes (19): badgeText(), NotificationMenu(), AppNotification, EMPTY, formatRelativeTime(), isSafeInternalLink(), listeners, loadMoreNotifications() (+11 more)

### Community 57 - "helmet"
Cohesion: 0.17
Nodes (22): AdminInvoiceInDto, AdminInvoiceLineInDto, AdminPaymentListOutDto, CheckoutInDto, CheckoutLineOutDto, CheckoutQuoteInDto, PaymentConfigOutDto, PaymentItemOutDto (+14 more)

### Community 58 - "mongoose"
Cohesion: 0.16
Nodes (9): SendNotificationResult, NotificationModel, absoluteLink(), after(), NotificationMailer, NotificationService, SendNotificationOptions, toNotificationOutDto() (+1 more)

### Community 60 - ".toOut"
Cohesion: 0.16
Nodes (21): isCustomerSet(), isSetOnce(), builtInsFor(), isDuplicateKeyError(), resetFoldersOf(), toRunOut(), valuesOf(), BUILT_IN_VARIABLES (+13 more)

### Community 61 - "deployment.controller.ts"
Cohesion: 0.22
Nodes (11): AdminDeploymentRowOutDto, DeploymentBulkOutDto, DeploymentSyncOutDto, DeploymentController, fail(), ok(), productIdOf(), target() (+3 more)

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
Cohesion: 0.17
Nodes (10): env, HASH, mailer, googleOAuth, GoogleProfile, ISSUERS, readIdToken(), AccessTokenPayload (+2 more)

### Community 66 - "popover.tsx"
Cohesion: 0.12
Nodes (24): CounterInterface, CounterModel, counterSchema, nextSequence(), PAYMENT_ITEM_KINDS, PAYMENT_SOURCES, PAYMENT_STATUSES, PaymentInterface (+16 more)

### Community 67 - "appConfig.controller.ts"
Cohesion: 0.27
Nodes (8): CheckoutQuoteOutDto, BasketInterface, BasketItem, basketItemSchema, BasketModel, basketSchema, BasketService, clampQuantity()

### Community 68 - "route.tsx"
Cohesion: 0.22
Nodes (8): PurchaseOutDto, PURCHASE_SOURCES, PurchaseInterface, PurchaseSource, PurchaseModel, purchaseSchema, isDuplicateKeyError(), PurchaseService

### Community 69 - "@getbrevo/brevo"
Cohesion: 0.29
Nodes (14): buildInvoicePdf(), C, formatDate(), formatDateTime(), formatIdr(), InvoicePdfInput, statusBadge(), emailItems() (+6 more)

### Community 70 - "lucide-react"
Cohesion: 0.09
Nodes (24): TICKET_STATUSES, TicketInterface, ticketSchema, SENDER_ROLES, TICKET_ENTRY_KINDS, TicketAttachment, TicketMessageInterface, attachmentSchema (+16 more)

### Community 72 - "tsconfig.json"
Cohesion: 0.22
Nodes (8): compilerOptions, forceConsistentCasingInFileNames, outDir, rootDir, extends, include, src/**/*.ts, @tsconfig/node22/tsconfig.json

### Community 74 - "react-hot-toast"
Cohesion: 0.08
Nodes (19): PricingGrid(), absoluteUrl(), jsonLd(), LinkTag, MetaTag, ORGANIZATION_LD, seo(), SeoInput (+11 more)

### Community 75 - "tailwindcss"
Cohesion: 0.13
Nodes (15): ApiResponseDto, requireAdmin(), uploadSingleImage(), adminController, deploymentController, dokployController, paymentController, productController (+7 more)

### Community 76 - "register.tsx"
Cohesion: 0.16
Nodes (12): fail(), PaymentController, sendPdf(), statusOf(), withUser(), listPayments(), mongoPaymentStore, PaymentGroup (+4 more)

### Community 77 - "$productId.tsx"
Cohesion: 0.36
Nodes (4): fail(), ok(), ProductController, parseRouteId()

### Community 78 - "purchase.model.ts"
Cohesion: 0.36
Nodes (7): bootstrapBranding(), Branding, BrandingContext, BrandingContextValue, BrandingProvider(), fetchBranding(), invalidateBrandingCache()

### Community 79 - "deployments.tsx"
Cohesion: 0.22
Nodes (11): CheckDeploymentInDto, CheckDeploymentOutDto, CreateProductDto, PricingProductOutDto, ProductSummaryDto, ReorderProductImagesDto, GrantPurchaseInDto, ProductDeployment (+3 more)

### Community 80 - "parseRouteId"
Cohesion: 0.38
Nodes (5): fail(), ok(), UserProductController, parseParam(), parseAssignProductDto()

### Community 81 - "userProduct.planner.ts"
Cohesion: 0.24
Nodes (15): SendNotificationInDto, NotificationChannels, cleanNotificationBody(), cleanNotificationTitle(), firstString(), isObjectId(), isSafeInternalLink(), length() (+7 more)

### Community 82 - "Header.tsx"
Cohesion: 0.22
Nodes (8): background_color, description, display, icons, name, short_name, start_url, theme_color

### Community 84 - "run"
Cohesion: 0.17
Nodes (6): notificationController, router, makeUser(), SseEvent, TestUser, NotificationInputError

### Community 89 - "router.tsx"
Cohesion: 0.13
Nodes (16): GoogleConfigOutDto, GoogleSignInInDto, GoogleSignInOutDto, LoginInDto, LoginOutDto, RegisterInDto, RegisterOutDto, ResetPasswordInDto (+8 more)

### Community 94 - "Fedier template"
Cohesion: 0.14
Nodes (12): Frontend, Closing a ticket (with an optional AI summary), Commands, Contact page and support tickets, Environment, Fedier template, Layout, Notifications (+4 more)

### Community 99 - "config.ts"
Cohesion: 0.26
Nodes (6): LegalPage(), LegalSection, PrivacyPolicy(), SECTIONS, SECTIONS, Route

### Community 100 - "AdminService"
Cohesion: 0.21
Nodes (11): bulkKey(), DeploymentList(), needsAttention(), Overview(), quietLine(), Selection, ServiceCard(), ServiceGrid() (+3 more)

### Community 101 - "package.json"
Cohesion: 0.25
Nodes (7): author, description, keywords, license, name, type, version

### Community 102 - "scripts"
Cohesion: 0.25
Nodes (8): scripts, build, dev, format, format:check, start, test, type-check

### Community 103 - "SandboxChatForm.tsx"
Cohesion: 0.07
Nodes (41): period(), CreateRedeemCodesDialog(), UserDetailForm(), UserProductsForm(), UserPurchasesForm(), GoogleMark(), GoogleCallback(), State (+33 more)

### Community 104 - "apiResponse.dto.ts"
Cohesion: 0.47
Nodes (4): BasketController, fail(), ok(), productIdParam()

### Community 105 - ".sendOtp"
Cohesion: 0.22
Nodes (7): LoginForm(), LoginResponse, AuthSearch, safeRedirect(), validateAuthSearch(), Route, Route

### Community 106 - "PurchaseController"
Cohesion: 0.24
Nodes (8): fail(), ok(), PurchaseController, AlreadyOwnedError, paymentController, purchaseController, router, userProductController

### Community 107 - "deploymentCommand.ts"
Cohesion: 0.38
Nodes (4): commandComposeFile(), literal(), SCRIPT, CommandService

### Community 108 - "deployment.readiness.ts"
Cohesion: 0.60
Nodes (4): answered(), answers(), sleep(), waitUntilAnswering()

### Community 109 - "n8n hosting product"
Cohesion: 0.33
Nodes (5): Data and deletion, Deployment, Limits per customer, n8n hosting product, Variables

### Community 110 - "ListPagination.tsx"
Cohesion: 0.10
Nodes (38): BULK_ICONS, BULK_RULES, BulkTarget, CreateInvoiceDialog(), InvoiceLineEditor(), Line, lineTotal(), maxQuantity() (+30 more)

### Community 111 - "sitemap[.]xml.ts"
Cohesion: 0.20
Nodes (9): CHECK_COLOR, Stat(), STATE_DOT, StateBadge(), CHECK_STATE_LABELS, DeploymentState, ServiceCheckState, ServiceStatus (+1 more)

### Community 112 - "ticket.route.ts"
Cohesion: 0.39
Nodes (7): describe(), ExpiryNotice(), readDismissed(), Row, Expiry, expiryOf(), formatDaysLeft()

### Community 113 - "UserInterface"
Cohesion: 0.26
Nodes (7): authenticateByToken(), UserInterface, UserModel, userSchema, FakeUser, Express, Request

### Community 116 - "tsconfig.build.json"
Cohesion: 0.40
Nodes (4): exclude, extends, src/**/*.test.ts, ./tsconfig.json

### Community 117 - "ticketImage.ts"
Cohesion: 0.50
Nodes (4): Format, processTicketImage(), sniffImage(), TicketImageError

### Community 122 - "SideDrawer.tsx"
Cohesion: 0.24
Nodes (8): OtpInterface, OtpPurpose, OtpModel, otpSchema, hashOtp(), OtpCooldownError, OtpService, safeEqual()

### Community 133 - "CLAUDE.md"
Cohesion: 0.50
Nodes (3): 🌍 Always-Apply Rules (Global Context), 🎯 Auto-Select Rules (File-Specific), Project Notes

## Knowledge Gaps
- **504 isolated node(s):** `name`, `version`, `description`, `dev`, `start` (+499 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **22 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `run()` connect `TopicModel` to `tailwindcss`, `.toOut`, `purchase.model.ts`, `SandboxChatForm.tsx`?**
  _High betweenness centrality (0.160) - this node is a cross-community bridge._
- **Why does `cn()` connect `RolesAdminForm.tsx` to `mcp.service.ts`, `auth.service.test.ts`, `route.tsx`, `purchase.model.ts`, `AdminService`, `SandboxChatForm.tsx`, `apiKeyValidation.ts`, `@types/cors`, `ListPagination.tsx`, `app-config.tsx`, `ticket.route.ts`, `auth.route.ts`, `sitemap[.]xml.ts`, `$productId.tsx`, `register.tsx`, `purchase.model.ts`?**
  _High betweenness centrality (0.103) - this node is a cross-community bridge._
- **Why does `ProductsPlansForm()` connect `SandboxChatForm.tsx` to `$userId.tsx`, `TopicModel`?**
  _High betweenness centrality (0.080) - this node is a cross-community bridge._
- **What connects `name`, `version`, `description` to the rest of the system?**
  _504 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `mcp.service.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0673076923076923 - nodes in this community are weakly interconnected._
- **Should `parseApiKeyId` be split into smaller, more focused modules?**
  _Cohesion score 0.05306930693069307 - nodes in this community are weakly interconnected._
- **Should `utils.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07198228128460686 - nodes in this community are weakly interconnected._