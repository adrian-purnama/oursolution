# Graph Report - fedier  (2026-11-21)

## Corpus Check
- 384 files · ~247,365 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2649 nodes · 7421 edges · 133 communities (111 shown, 22 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 100 edges (avg confidence: 0.63)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `24d71e26`
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
- $productId.tsx
- index.tsx
- $ticketId.tsx
- SideDrawer.tsx
- @tanstack/react-devtools
- index.tsx
- pdfkit
- clsx
- prettier.config.js
- vite.config.ts
- CLAUDE.md
- AGENTS.md

## God Nodes (most connected - your core abstractions)
1. `cn()` - 137 edges
2. `apiFetch()` - 62 edges
3. `UserModel` - 59 edges
4. `Button()` - 56 edges
5. `DeploymentService` - 49 edges
6. `ProductModel` - 41 edges
7. `formatDateTime()` - 41 edges
8. `FileRoutesByPath` - 41 edges
9. `parseRouteId()` - 39 edges
10. `useAuth()` - 34 edges

## Surprising Connections (you probably didn't know these)
- `DeploymentPanel()` --indirect_call--> `run()`  [INFERRED]
  frontend/src/components/forms/deployment/DeploymentPanel.tsx → backend/src/middleware/requireAdmin.test.ts
- `ProductsPlansForm()` --indirect_call--> `run()`  [INFERRED]
  frontend/src/components/forms/profile/ProductsPlansForm.tsx → backend/src/middleware/requireAdmin.test.ts
- `UserMultiSelect()` --indirect_call--> `user()`  [INFERRED]
  frontend/src/components/forms/admin/UserMultiSelect.tsx → backend/src/modules/broadcast/broadcast.test.ts
- `UsersAdminForm()` --indirect_call--> `user()`  [INFERRED]
  frontend/src/components/forms/admin/UsersAdminForm.tsx → backend/src/modules/broadcast/broadcast.test.ts
- `bootstrapAuth()` --indirect_call--> `user()`  [INFERRED]
  frontend/src/context/authContext.tsx → backend/src/modules/broadcast/broadcast.test.ts

## Import Cycles
- None detected.

## Communities (133 total, 22 thin omitted)

### Community 0 - "mcp.service.ts"
Cohesion: 0.06
Nodes (53): State, State, CheckoutLineRow(), LinePatch, State, VariantChoices(), InvoiceDetail(), ItemsTable() (+45 more)

### Community 1 - "parseApiKeyId"
Cohesion: 0.22
Nodes (9): RedeemCodeModel, toProductSummary(), variantOf(), generateCode(), groupFilter(), isDuplicateKeyError(), RedeemCodeService, statusOf() (+1 more)

### Community 2 - "utils.ts"
Cohesion: 0.07
Nodes (23): FetchLike, itemName(), MidtransConfig, MidtransNotification, MidtransProvider, midtransStatus(), allowAllProvider, ChargeLine (+15 more)

### Community 3 - "index.ts"
Cohesion: 0.23
Nodes (13): EmailDelivery, InAppDelivery, NotificationOutDto, NotificationPageOutDto, ReadAllOutDto, SendNotificationResult, UnreadCountOutDto, absoluteLink() (+5 more)

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
Nodes (62): getRouter(), Register, @tanstack/react-router, Route, Route, Route, Route, AdminAppConfigRoute (+54 more)

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
Cohesion: 0.06
Nodes (45): checkDeployment(), DeploymentDraft, DeploymentFields(), EMPTY_DEPLOYMENT, fieldElementId(), focusField(), IssueRow(), toDeploymentBody() (+37 more)

### Community 14 - "package.json"
Cohesion: 0.04
Nodes (25): privatePage(), Route, Route, Route, Route, Route, Route, Route (+17 more)

### Community 15 - "index.tsx"
Cohesion: 0.11
Nodes (31): AdminInvoiceInDto, AdminInvoiceLineInDto, BasketLinePatchInDto, CheckoutInDto, CheckoutItemInDto, CheckoutLineOutDto, CheckoutQuoteInDto, CheckoutSwitchOutDto (+23 more)

### Community 16 - "index.tsx"
Cohesion: 0.19
Nodes (29): checkErrorMessage(), asRecord(), parseAccessUrl(), parseAssignProductDto(), parseBoolean(), parseColor(), parseCommand(), parseCommands() (+21 more)

### Community 17 - "route.tsx"
Cohesion: 0.17
Nodes (20): ProductInterface, hasVariants(), customerFolders, hostPaths(), interpolate(), isInside(), isRecord(), isUnderDataRoot() (+12 more)

### Community 18 - "scan.ts"
Cohesion: 0.19
Nodes (8): TicketOutDto, TicketSummaryOutDto, TicketModel, TicketMessageModel, messageOf(), notFound(), remaining(), TicketService

### Community 19 - "index.ts"
Cohesion: 0.27
Nodes (5): ProductOutDto, liveFilter(), ProductService, toProductOut(), variantListOf()

### Community 20 - "Stitch to Remotion Walkthrough Videos"
Cohesion: 0.37
Nodes (5): fail(), ok(), TicketController, ticketIdOf(), validate()

### Community 21 - "TopicModel"
Cohesion: 0.11
Nodes (16): AdminDeploymentRowOutDto, DeploymentOutDto, DeploymentModel, DeploymentChangeModel, DeploymentRunModel, ProductModel, product(), user() (+8 more)

### Community 22 - "new.tsx"
Cohesion: 0.16
Nodes (18): AdminUserDetailOutDto, AdminUserOutDto, CreateAdminUserDto, UpdateAdminUserDto, USER_ROLES, UserRole, AppConfigPayload, AdminService (+10 more)

### Community 23 - "login.tsx"
Cohesion: 0.07
Nodes (33): connectDatabase(), env, bootstrap(), createApp(), format(), location(), logger, AuthError (+25 more)

### Community 24 - "widget.service.ts"
Cohesion: 0.20
Nodes (9): AssignProductDto, UserPlanOutDto, UserProductPeriodModel, VariantHost, AppendPlan, liveFilter(), originFields(), toPeriodLike() (+1 more)

### Community 25 - "register.tsx"
Cohesion: 0.06
Nodes (57): BroadcastsAdminForm(), State, RedeemCodesAdminForm(), State, STATUS_CLASS, STATUS_LABEL, UserCell(), Filter (+49 more)

### Community 26 - "Spline 3D"
Cohesion: 0.30
Nodes (6): brand(), color, escapeHtml(), layout(), logo, MailService

### Community 27 - "purchase.service.ts"
Cohesion: 0.04
Nodes (84): BULK_ICONS, BULK_RULES, BulkDeploymentActions(), bulkKey(), BulkResult(), BulkTarget, CHECK_TEXT, DeploymentRow() (+76 more)

### Community 28 - "compilerOptions"
Cohesion: 0.07
Nodes (27): compilerOptions, allowImportingTsExtensions, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+19 more)

### Community 29 - "AuthController"
Cohesion: 0.16
Nodes (7): AuthController, googleCode(), normalizeEmail(), googleOAuth, GoogleProfile, ISSUERS, readIdToken()

### Community 30 - "purchase.model.ts"
Cohesion: 0.08
Nodes (42): AppConfigData, AppConfigForm(), CONTACT_FIELDS, ToggleRow(), BroadcastComposeForm(), chipClass(), DokployProjectCombobox(), CheckoutButton() (+34 more)

### Community 31 - "devDependencies"
Cohesion: 0.08
Nodes (25): eslint, devDependencies, eslint, prettier, @tailwindcss/typography, @tanstack/devtools-vite, @tanstack/eslint-config, @tanstack/router-cli (+17 more)

### Community 32 - "normalizeImage"
Cohesion: 0.19
Nodes (7): AppConfigInterface, ContactDetails, EMPTY_CONTACT, AppConfigModel, appConfigSchema, contactSchema, AppConfigService

### Community 33 - "auth.service.test.ts"
Cohesion: 0.11
Nodes (19): at(), BACKUPS, CHAT, ChatbotScene(), DashboardScene(), HeroVisual(), HostingScene(), NAV (+11 more)

### Community 34 - "RolesAdminForm.tsx"
Cohesion: 0.09
Nodes (31): badgeText(), NotificationMenu(), DropdownMenu(), DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuRadioItem() (+23 more)

### Community 35 - "app-config.tsx"
Cohesion: 0.15
Nodes (9): CheckoutOutDto, PaymentOutDto, PaymentSource, PaymentStatus, mergeDuplicateItems(), Deps, PaymentService, PaymentStore (+1 more)

### Community 36 - "route.tsx"
Cohesion: 0.12
Nodes (17): Footer(), FOOTER_COLUMNS, FooterLink, ServiceAction(), ServiceCard(), ServiceIcon(), ServiceLogo(), ServicesPage() (+9 more)

### Community 38 - "dependencies"
Cohesion: 0.08
Nodes (25): class-variance-authority, cmdk, cn, dependencies, class-variance-authority, cmdk, cn, @gsap/react (+17 more)

### Community 39 - "brandingContext.tsx"
Cohesion: 0.12
Nodes (19): DokployProjectOutDto, dokployUrl(), DokployController, containersOutcome, ContainersState, deploymentOutcome, DokployCompose, DokployEnvironment (+11 more)

### Community 40 - "pricing.tsx"
Cohesion: 0.09
Nodes (35): DeploymentActionInDto, DeploymentBulkInDto, DeploymentBulkItemOutDto, DeploymentBulkOutDto, DeploymentChangeOutDto, DeploymentCommandOutDto, DeploymentOverridesOutDto, DeploymentRunOutDto (+27 more)

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
Cohesion: 0.22
Nodes (16): CloseTicketOutDto, TicketClosureOutDto, TicketErrorDataDto, TicketPageOutDto, ValidationError, cleanBody(), cleanSubject(), CloseTicketInput (+8 more)

### Community 45 - "@types/cors"
Cohesion: 0.23
Nodes (9): Command(), CommandEmpty(), CommandGroup(), CommandInput(), CommandItem(), CommandList(), Popover(), PopoverContent() (+1 more)

### Community 46 - "dependencies"
Cohesion: 0.08
Nodes (25): dependencies, bcrypt, cors, express, express-rate-limit, jsonwebtoken, mongoose, multer (+17 more)

### Community 47 - "useAuth"
Cohesion: 0.18
Nodes (21): Bucket, buckets, deleteFile(), deleteFileIfExists(), findFile(), getBucket(), GridFsFileResult, openDownload() (+13 more)

### Community 48 - "ProfileForm.tsx"
Cohesion: 0.11
Nodes (33): ACTION_LABELS, ActualContainers, allowedActions(), bulkPlan(), BUSY_STATES, commandBlocker(), DomainCheck, domainIssue() (+25 more)

### Community 49 - "auth.route.ts"
Cohesion: 0.50
Nodes (4): AdminLayout(), breadcrumbFor(), NAV_ITEMS, Route

### Community 50 - "$userId.tsx"
Cohesion: 0.15
Nodes (17): DEPLOYMENT_TYPES, DeploymentCommand, DeploymentDomain, DeploymentType, DeploymentVariable, NOTICE_TONES, NoticeTone, PRODUCT_KINDS (+9 more)

### Community 51 - "components.json"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 52 - "route.tsx"
Cohesion: 0.18
Nodes (16): checkDockerCompose(), checkEnvFile(), closest(), closingBrace(), ComposeIssue, ComposeIssueSeverity, editDistance(), Entry (+8 more)

### Community 53 - "devDependencies"
Cohesion: 0.08
Nodes (25): devDependencies, mongodb-memory-server, prettier, @tsconfig/node22, tsx, @types/bcrypt, @types/cors, @types/jsonwebtoken (+17 more)

### Community 54 - "UsersAdminForm.tsx"
Cohesion: 0.11
Nodes (13): contentOf(), LLM_ERROR_CODES, LlmChatInput, LlmClient, LlmError, LlmErrorCode, LlmMessage, LlmRole (+5 more)

### Community 55 - "index.tsx"
Cohesion: 0.14
Nodes (14): router, busyTicket(), kinds(), makeProduct(), makeUser(), png(), Reply, Sent (+6 more)

### Community 56 - "$productId.tsx"
Cohesion: 0.17
Nodes (20): ProductSummaryDto, CreateRedeemCodesInDto, REDEEM_CODE_GROUPS, RedeemCodeGroup, RedeemCodeListOutDto, RedeemCodeOutDto, RedeemCodeUserDto, RedeemResultOutDto (+12 more)

### Community 57 - "helmet"
Cohesion: 0.22
Nodes (19): BasketController, fail(), ok(), productIdParam(), asRecord(), parseAdminInvoiceInDto(), parseApplyVariant(), parseBasketAddInDto() (+11 more)

### Community 58 - "mongoose"
Cohesion: 0.18
Nodes (8): NotificationModel, after(), before(), NotificationMailer, NotificationService, SendNotificationOptions, toNotificationOutDto(), TicketServiceDeps

### Community 60 - ".toOut"
Cohesion: 0.15
Nodes (31): isCustomerSet(), isSetOnce(), builtInsFor(), effectiveOf(), filledValuesOf(), overridesOf(), resetFoldersOf(), toRunOut() (+23 more)

### Community 61 - "deployment.controller.ts"
Cohesion: 0.28
Nodes (8): DeploymentController, fail(), ok(), productIdOf(), target(), DeploymentBusyError, DeploymentLimitError, DeploymentView

### Community 62 - "deployment.model.ts"
Cohesion: 0.07
Nodes (47): BroadcastAudienceInDto, BroadcastAudiencePreviewOutDto, BroadcastListOutDto, BroadcastOutDto, BroadcastRecipientDto, SendBroadcastInDto, DeploymentSyncItemOutDto, BROADCAST_AUDIENCE_TYPES (+39 more)

### Community 63 - "package.json"
Cohesion: 0.22
Nodes (8): imports, name, pnpm, onlyBuiltDependencies, private, type, esbuild, lightningcss

### Community 64 - "scripts"
Cohesion: 0.22
Nodes (9): scripts, build, check, dev, format, generate-routes, lint, preview (+1 more)

### Community 65 - "purchase.model.ts"
Cohesion: 0.12
Nodes (14): authenticateByToken(), UserInterface, UserModel, userSchema, FakeUser, HASH, now, mailer (+6 more)

### Community 66 - "popover.tsx"
Cohesion: 0.13
Nodes (22): AdminPaymentListOutDto, PaymentListOutDto, CounterInterface, CounterModel, counterSchema, nextSequence(), PaymentModel, clampQuantity() (+14 more)

### Community 67 - "appConfig.controller.ts"
Cohesion: 0.60
Nodes (3): CheckoutQuoteOutDto, BasketModel, BasketService

### Community 68 - "route.tsx"
Cohesion: 0.30
Nodes (5): GrantPurchaseInDto, PurchaseOutDto, PurchaseModel, isDuplicateKeyError(), PurchaseService

### Community 69 - "@getbrevo/brevo"
Cohesion: 0.29
Nodes (14): buildInvoicePdf(), C, formatDate(), formatDateTime(), formatIdr(), InvoicePdfInput, statusBadge(), emailItems() (+6 more)

### Community 70 - "lucide-react"
Cohesion: 0.21
Nodes (13): TicketMessageOutDto, TICKET_STATUSES, TicketInterface, TicketStatus, ticketSchema, SENDER_ROLES, SenderRole, TICKET_ENTRY_KINDS (+5 more)

### Community 72 - "tsconfig.json"
Cohesion: 0.22
Nodes (8): compilerOptions, forceConsistentCasingInFileNames, outDir, rootDir, extends, include, src/**/*.ts, @tsconfig/node22/tsconfig.json

### Community 74 - "react-hot-toast"
Cohesion: 0.09
Nodes (17): PricingGrid(), absoluteUrl(), jsonLd(), LinkTag, MetaTag, ORGANIZATION_LD, seo(), SeoInput (+9 more)

### Community 75 - "tailwindcss"
Cohesion: 0.09
Nodes (19): ApiResponseDto, requireAdmin(), run(), uploadSingleImage(), adminController, broadcastController, deploymentController, dokployController (+11 more)

### Community 76 - "register.tsx"
Cohesion: 0.15
Nodes (13): fail(), PaymentController, sendPdf(), statusOf(), withUser(), listPayments(), mongoPaymentStore, PaymentGroup (+5 more)

### Community 77 - "$productId.tsx"
Cohesion: 0.36
Nodes (4): fail(), ok(), ProductController, parseRouteId()

### Community 78 - "purchase.model.ts"
Cohesion: 0.36
Nodes (7): bootstrapBranding(), Branding, BrandingContext, BrandingContextValue, BrandingProvider(), fetchBranding(), invalidateBrandingCache()

### Community 79 - "deployments.tsx"
Cohesion: 0.23
Nodes (11): CheckDeploymentInDto, CheckDeploymentOutDto, CreateProductDto, PricingProductOutDto, PricingVariantOutDto, ReorderProductImagesDto, ProductDeployment, ProductKind (+3 more)

### Community 80 - "parseRouteId"
Cohesion: 0.24
Nodes (8): fail(), ok(), UserProductController, paymentController, purchaseController, router, userProductController, parseParam()

### Community 81 - "userProduct.planner.ts"
Cohesion: 0.27
Nodes (13): SendNotificationInDto, NotificationChannels, cleanNotificationBody(), cleanNotificationTitle(), firstString(), isObjectId(), length(), parseChannels() (+5 more)

### Community 82 - "Header.tsx"
Cohesion: 0.22
Nodes (8): background_color, description, display, icons, name, short_name, start_url, theme_color

### Community 83 - "ticketImage.ts"
Cohesion: 0.15
Nodes (27): ProductPeriodOutDto, UserProductRowOutDto, ProductPeriodSource, dailyPriceIdr(), activePeriod(), assertDeletable(), assertFree(), byStart() (+19 more)

### Community 84 - "run"
Cohesion: 0.18
Nodes (5): notificationController, router, SseEvent, TestUser, NotificationInputError

### Community 88 - "$productId.tsx"
Cohesion: 0.09
Nodes (19): alreadyClosed(), imagePath(), IncomingImage, isUnread(), MessageDoc, Photo, send(), signedImageUrl() (+11 more)

### Community 89 - "router.tsx"
Cohesion: 0.13
Nodes (16): GoogleConfigOutDto, GoogleSignInInDto, GoogleSignInOutDto, LoginInDto, LoginOutDto, RegisterInDto, RegisterOutDto, ResetPasswordInDto (+8 more)

### Community 94 - "Fedier template"
Cohesion: 0.14
Nodes (12): Frontend, Closing a ticket (with an optional AI summary), Commands, Contact page and support tickets, Environment, Fedier template, Layout, Notifications (+4 more)

### Community 99 - "config.ts"
Cohesion: 0.10
Nodes (13): FinalCta(), ASSURANCES, HeroSection(), ServicesOverview(), REASONS, LegalPage(), LegalSection, PrivacyPolicy() (+5 more)

### Community 100 - "AdminService"
Cohesion: 0.12
Nodes (18): publicFileUrl(), ProductImageOutDto, UpdateProductDto, coverUrl(), imagesOf(), isDuplicateKeyError(), noticesOf(), ProductDoc (+10 more)

### Community 101 - "package.json"
Cohesion: 0.25
Nodes (7): author, description, keywords, license, name, type, version

### Community 102 - "scripts"
Cohesion: 0.25
Nodes (8): scripts, build, dev, format, format:check, start, test, type-check

### Community 103 - "SandboxChatForm.tsx"
Cohesion: 0.05
Nodes (54): period(), CreateRedeemCodesDialog(), PaymentsAdminForm(), UserDetailForm(), UserPatch, UserMultiSelect(), UserProductsForm(), UserPurchasesForm() (+46 more)

### Community 104 - "apiResponse.dto.ts"
Cohesion: 0.14
Nodes (9): GoogleCallback(), takeGoogleIntent(), AuthSearch, safeRedirect(), validateAuthSearch(), GoogleCallbackSearch, Route, Route (+1 more)

### Community 105 - ".sendOtp"
Cohesion: 0.29
Nodes (5): fitVariants(), removedVariantIds(), sameSources(), DEPLOYMENT, variant()

### Community 106 - "PurchaseController"
Cohesion: 0.17
Nodes (15): ProductsPlansForm(), chartWindow(), describePeriod(), joins(), percent(), PlanGantt(), Range, rowStatus() (+7 more)

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
Cohesion: 0.09
Nodes (46): AudienceType, Counter(), Preview, ProductMatch, CreateInvoiceDialog(), InvoiceLineEditor(), Line, lineTotal() (+38 more)

### Community 111 - "sitemap[.]xml.ts"
Cohesion: 0.22
Nodes (7): cloudflareTunnelId(), isDevelopmentBuild(), isLocalHost(), jwtSecret(), mediaSigningSecret(), midtransNotificationUrl(), required()

### Community 112 - "ticket.route.ts"
Cohesion: 0.47
Nodes (4): CHANGE_TARGETS, ChangeTarget, DeploymentChangeInterface, deploymentChangeSchema

### Community 113 - "UserInterface"
Cohesion: 0.36
Nodes (7): changeLine(), DeploymentOverridesForm(), payloadOf(), Row, rowsOf(), DeploymentChange, DeploymentOverrides

### Community 115 - "yaml"
Cohesion: 0.24
Nodes (9): BillingHistory(), Tabs(), TabsContent(), TabsList(), tabsListVariants, TabsTrigger(), UserTab, ProfileTab (+1 more)

### Community 116 - "tsconfig.build.json"
Cohesion: 0.40
Nodes (4): exclude, extends, src/**/*.test.ts, ./tsconfig.json

### Community 117 - "ticketImage.ts"
Cohesion: 0.50
Nodes (4): Format, processTicketImage(), sniffImage(), TicketImageError

### Community 118 - "app-config.tsx"
Cohesion: 0.27
Nodes (3): NotificationServiceDeps, NotificationStreamHub, SseClient

### Community 119 - "$productId.tsx"
Cohesion: 0.57
Nodes (3): fail(), ok(), PurchaseController

### Community 120 - "index.tsx"
Cohesion: 0.47
Nodes (4): PURCHASE_SOURCES, PurchaseInterface, PurchaseSource, purchaseSchema

### Community 122 - "SideDrawer.tsx"
Cohesion: 0.24
Nodes (8): OtpInterface, OtpPurpose, OtpModel, otpSchema, hashOtp(), OtpCooldownError, OtpService, safeEqual()

### Community 123 - "@tanstack/react-devtools"
Cohesion: 0.60
Nodes (3): NOTIFICATION_CHANNELS, NotificationInterface, notificationSchema

### Community 124 - "index.tsx"
Cohesion: 0.40
Nodes (3): CheckoutForm(), CheckoutSearch, Route

### Community 133 - "CLAUDE.md"
Cohesion: 0.50
Nodes (3): 🌍 Always-Apply Rules (Global Context), 🎯 Auto-Select Rules (File-Specific), Project Notes

## Knowledge Gaps
- **541 isolated node(s):** `name`, `version`, `description`, `dev`, `start` (+536 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **22 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `user()` connect `TopicModel` to `purchase.model.ts`, `new.tsx`, `SandboxChatForm.tsx`?**
  _High betweenness centrality (0.223) - this node is a cross-community bridge._
- **Why does `UserModel` connect `purchase.model.ts` to `parseApiKeyId`, `index.ts`, `scan.ts`, `TopicModel`, `new.tsx`, `widget.service.ts`, `normalizeImage`, `ProfileForm.tsx`, `index.tsx`, `$productId.tsx`, `mongoose`, `.toOut`, `deployment.model.ts`, `popover.tsx`, `route.tsx`, `@getbrevo/brevo`, `register.tsx`, `ticketImage.ts`, `run`, `$productId.tsx`, `router.tsx`?**
  _High betweenness centrality (0.214) - this node is a cross-community bridge._
- **Why does `cn()` connect `purchase.model.ts` to `mcp.service.ts`, `auth.service.test.ts`, `RolesAdminForm.tsx`, `route.tsx`, `SandboxChatForm.tsx`, `PurchaseController`, `apiKeyValidation.ts`, `@types/cors`, `ListPagination.tsx`, `app-config.tsx`, `UserInterface`, `auth.route.ts`, `register.tsx`, `purchase.service.ts`?**
  _High betweenness centrality (0.118) - this node is a cross-community bridge._
- **What connects `name`, `version`, `description` to the rest of the system?**
  _541 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `mcp.service.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06292966684294024 - nodes in this community are weakly interconnected._
- **Should `utils.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07087486157253599 - nodes in this community are weakly interconnected._
- **Should `routeTree.gen.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0317907444668008 - nodes in this community are weakly interconnected._