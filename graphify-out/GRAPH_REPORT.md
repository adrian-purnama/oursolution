# Graph Report - fedier  (2026-11-10)

## Corpus Check
- 227 files · ~105,500 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2056 nodes · 2769 edges · 140 communities (124 shown, 16 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 23 edges (avg confidence: 0.53)
- Token cost: 0 input · 0 output

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
- widget.service.ts
- register.tsx
- Spline 3D
- Color System
- compilerOptions
- shadcn/ui Setup Guide
- Design Advisor
- devDependencies
- Conversion Audit
- Premium Layer
- RolesAdminForm.tsx
- NotebookLM as a Design Knowledge Base
- auth.service.test.ts
- Stitch Build Loop
- dependencies
- brandingContext.tsx
- Component Sniping
- Stitch DESIGN.md Skill
- cn
- Atelier Router
- Enhance Prompt for Stitch
- Framer Motion
- dependencies
- useAuth
- Framer Motion (Baseline)
- Scroll Frames
- otp.service.ts
- components.json
- Prompt Anti-Patterns (What NOT to Do)
- devDependencies
- Atelier Skills
- Framer Motion Recipes
- Component Catalog
- Typography
- Design Decisions
- Remotion Composition Checklist
- GitHub to Vercel Deployment Pipeline
- AppConfigService
- Hero Archetypes
- Motion Effects
- Tailwind CSS v4 Patterns
- Project Brief: [Project Name]
- Agent Team Design Workflow
- UserModel
- creative-director.md
- Proven Pairings (Baseline)
- shadcn/ui Customization Guide
- Migration Guide to shadcn/ui
- tsconfig.json
- package.json
- index.tsx
- Example Directive: Website Build
- api.ts
- UI Reviewer Agent
- Google Stitch Mastery Guide
- Stitch SDK Integration (Recommended)
- Lessons from a 10-Screen Dashboard Build
- Design Scout
- Reference Analysis
- Form Components
- [Client Name] Brand Guidelines
- package.json
- AdminController
- frontend-builder.md
- router.tsx
- Color Catalog
- Overlay Components
- shadcn/ui Component Catalog
- Fedier template
- Common Stitch Issues & Fixes
- GSAP Recipes
- package.json
- Stitch to React Components
- screenshot.js
- package.json
- scripts
- SandboxChatForm.tsx
- page-builder.md
- Data Display
- Brand Assets Template
- The Prompt Formula
- Layout Components
- ListPagination.tsx
- Prompt Templates
- Component Composition Patterns
- Architecture Quality Gate
- tsconfig.build.json
- Export & Handoff
- Iteration Workflow
- Screen Generation Strategy
- WalkthroughComposition.tsx
- form-pattern.tsx
- SideDrawer.tsx
- Feedback Components
- Utility Components
- Navigation
- prettier.config.js
- vite.config.ts
- Stitch API reference
- CLAUDE.md
- screen-slide-template.tsx
- Advanced Components
- gold-standard-card.tsx
- component-template.tsx
- scroll-frame-component.tsx
- proxy.js
- validate.js
- download-stitch-asset.sh
- verify-setup.sh
- fetch-stitch.sh
- @tsconfig/node22
- AGENTS.md

## God Nodes (most connected - your core abstractions)
1. `cn()` - 41 edges
2. `useAuth()` - 21 edges
3. `UserModel` - 19 edges
4. `FileRoutesByPath` - 18 edges
5. `AppConfigService` - 17 edges
6. `compilerOptions` - 17 edges
7. `Google Stitch Mastery Guide` - 16 edges
8. `shadcn/ui Component Catalog` - 16 edges
9. `Framer Motion Recipes` - 16 edges
10. `apiFetch()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `ProfileForm()` --indirect_call--> `run()`  [INFERRED]
  frontend/src/components/forms/profile/ProfileForm.tsx → Atelier/tools/stitch-sdk/validate.js
- `DataTableExample()` --references--> `react`  [EXTRACTED]
  Atelier/skills/shadcn-ui/examples/data-table.tsx → frontend/package.json
- `buildTimeline()` --indirect_call--> `period()`  [INFERRED]
  backend/src/modules/userPlan/userPlan.planner.ts → backend/src/modules/userPlan/userPlan.planner.test.ts
- `ToggleRow()` --calls--> `cn()`  [EXTRACTED]
  frontend/src/components/forms/admin/AppConfigForm.tsx → frontend/src/lib/utils.ts
- `LoginForm()` --calls--> `useAuth()`  [EXTRACTED]
  frontend/src/components/forms/auth/LoginForm.tsx → frontend/src/context/authContext.tsx

## Import Cycles
- None detected.

## Communities (140 total, 16 thin omitted)

### Community 0 - "mcp.service.ts"
Cohesion: 0.26
Nodes (14): Bucket, buckets, deleteFile(), deleteFileIfExists(), findFile(), getBucket(), GridFsFileResult, openDownload() (+6 more)

### Community 1 - "parseApiKeyId"
Cohesion: 0.05
Nodes (40): 1. Split Hero (Text Left + Visual Right), 2. Centered Hero, 3. Full-Bleed Media Hero, 4. Manifesto Hero, 5. Asymmetric Overlap Hero, Always Use CSS Variables, Anti-AI-Slop Checklist, Background Treatments (+32 more)

### Community 2 - "utils.ts"
Cohesion: 0.06
Nodes (35): Analytics & Data Visualization, Arc Browser, Attio, Cal.com, CRM & Pipeline, Dark Mode SaaS Dashboards, Datadog, Dub.co (+27 more)

### Community 3 - "index.ts"
Cohesion: 0.05
Nodes (59): CreatePlanDto, PlanOutDto, PlanSummaryDto, PricingPlanOutDto, UpdatePlanDto, AssignPlanDto, PlanEndSpec, PlanSegmentOutDto (+51 more)

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
Nodes (50): getRouter(), Register, @tanstack/react-router, Route, Route, Route, Route, Route (+42 more)

### Community 9 - "SandboxOcrForm.tsx"
Cohesion: 0.40
Nodes (4): Boundaries, Examples, Format, Scoring

### Community 10 - "apiKeyValidation.ts"
Cohesion: 0.23
Nodes (8): requireAdmin(), run(), upload, uploadSingleImage(), adminController, planController, router, userPlanController

### Community 11 - "ProjectSidebar.tsx"
Cohesion: 0.50
Nodes (3): Boundaries, Output, Scan

### Community 12 - "widget.dto.ts"
Cohesion: 0.38
Nodes (4): ChangeAppLogoInput, ALLOWED_FORMATS, NormalizedImage, normalizeImage()

### Community 14 - "package.json"
Cohesion: 0.06
Nodes (33): Agency Landing Page Revamp (March 2026), Agent Teams, Atelier Expertise Log, Atelier Updates Made, Component Libraries (Tailwind v4 Compatibility), CRO Insights, Design Decisions That Worked, Design Decisions That Worked (+25 more)

### Community 15 - "index.tsx"
Cohesion: 0.16
Nodes (10): AuthError, credentialRateLimit, otpRateLimit, readBearer(), requireAuth(), requireUser, authController, router (+2 more)

### Community 16 - "index.tsx"
Cohesion: 0.06
Nodes (32): 1. Ciridae.com — AI Consulting SaaS, 2. Linear.app — SaaS Product Tool, 3. Resend.com — Developer Email SaaS, Apply to Healthcare SaaS, Apply to Healthcare SaaS, Apply to Healthcare SaaS, Color, Color (+24 more)

### Community 17 - "route.tsx"
Cohesion: 0.40
Nodes (5): Changing Brand Colors, Color Customization, Creating a Color Scheme, Tools for Color Selection, Understanding the Color System

### Community 18 - "scan.ts"
Cohesion: 0.33
Nodes (6): Advanced Features, Base UI Support, Step 3: Verify Configuration, Step 4: Configure Path Aliases, Step 5: Add Components, Visual Styles

### Community 19 - "index.ts"
Cohesion: 0.40
Nodes (5): "Cannot find module '@/components/ui/button'", Components look broken, Styles not applying, Troubleshooting, TypeScript errors in components

### Community 20 - "Stitch to Remotion Walkthrough Videos"
Cohesion: 0.06
Nodes (31): Advanced Features, Architecture, Best Practices, Common Patterns, Dynamic Text Extraction, Execution Steps, File Structure, Integration with Remotion Skills (+23 more)

### Community 21 - "TopicModel"
Cohesion: 0.07
Nodes (29): 1. Images, 2. Performance, 3. Accessibility & SEO, 4. Responsive, 5. Deployment, 7. Final Verification, Above the Fold (Hero Images), Analyze Bundle (+21 more)

### Community 22 - "new.tsx"
Cohesion: 0.07
Nodes (29): Animation Check, Animations look frozen mid-frame, Anti-AI-Slop Visual Check, Basic Usage, Color Check, Colors look different in screenshot vs browser, Comparison Workflow, Content Check (+21 more)

### Community 24 - "widget.service.ts"
Cohesion: 0.19
Nodes (11): connectDatabase(), ApiResponseDto, bootstrap(), createApp(), format(), location(), logger, AppConfigController (+3 more)

### Community 25 - "register.tsx"
Cohesion: 0.07
Nodes (29): 1. Browse Available Components, 1. Theme Customization, 2. Component Installation, 2. Component Variants, 3. Extending Components, 3. Registry and Custom Registries, Accessibility, Blocks and Complex Components (+21 more)

### Community 26 - "Spline 3D"
Cohesion: 0.07
Nodes (29): Access the Spline Runtime, Background Removal, Basic Usage, Best Use Cases, Browse the Community Library, Code Export (Recommended), Common Runtime Methods, Dependencies (+21 more)

### Community 27 - "Color System"
Cohesion: 0.07
Nodes (27): Anti-Patterns, Canva Color Extraction Hack, Color System, Common Contrast Traps, Contrast Checking, Core Principle: Never Hardcode Hex Values, CSS Variables System, Dark Mode Token Swap (+19 more)

### Community 28 - "compilerOptions"
Cohesion: 0.07
Nodes (27): compilerOptions, allowImportingTsExtensions, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+19 more)

### Community 29 - "shadcn/ui Setup Guide"
Cohesion: 0.25
Nodes (8): Additional Resources, Existing Project Setup, Next Steps, Prerequisites, shadcn/ui Setup Guide, Step 1: Ensure Tailwind CSS is Installed, Step 2: Initialize shadcn/ui, Verification Steps

### Community 30 - "Design Advisor"
Cohesion: 0.07
Nodes (26): Action 1: RECOMMEND Font Pairings, Action 2: RECOMMEND Hero Archetype, Action 3: RECOMMEND Color System, Action 4: SUGGEST Component Patterns, Action 5: FLAG Anti-Slop Risks, Action 6: CHECK Brand Assets, Action 7: CHECK Expertise, After the Interview: Advisor Actions (+18 more)

### Community 31 - "devDependencies"
Cohesion: 0.05
Nodes (42): eslint, devDependencies, eslint, prettier, @tailwindcss/typography, @tanstack/devtools-vite, @tanstack/eslint-config, @tanstack/router-cli (+34 more)

### Community 32 - "Conversion Audit"
Cohesion: 0.08
Nodes (25): 1. Section Reorder, 2. Premium Component Suggestions, 3. Background Treatments, 4. Animation Upgrades, 5. Copy Rewrites, Anti-AI-Slop Copy Reference, Asset Requirements Documentation, Audit Protocol (5 Phases) (+17 more)

### Community 33 - "Premium Layer"
Cohesion: 0.08
Nodes (23): Accent-left indicator, Checklist, Component Libraries for Premium Effects, CSS Utility Class, Dark Mode (Recommended), Inner top highlight, Light Mode, On Dark Backgrounds (tinted transparent) (+15 more)

### Community 34 - "RolesAdminForm.tsx"
Cohesion: 0.09
Nodes (26): UserPatch, UsersAdminForm(), DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuRadioItem(), DropdownMenuSeparator() (+18 more)

### Community 35 - "NotebookLM as a Design Knowledge Base"
Cohesion: 0.09
Nodes (21): Adding Sources, Audio Overviews, Available Tools (29 total), Best Practices, Brand Research, Client-Specific Knowledge, Competitive Intelligence, Configuration (+13 more)

### Community 36 - "auth.service.test.ts"
Cohesion: 0.50
Nodes (4): Adding Custom Variants, Component Customization, Creating Composite Components, Using Variants

### Community 37 - "Stitch Build Loop"
Cohesion: 0.10
Nodes (20): Common Pitfalls, Design System Integration, Execution Protocol, File Structure Reference, Option A: SDK (preferred), Option B: MCP (legacy), Orchestration Options, Overview (+12 more)

### Community 38 - "dependencies"
Cohesion: 0.05
Nodes (37): columns, data, DataTableExample(), User, class-variance-authority, clsx, cn, dependencies (+29 more)

### Community 39 - "brandingContext.tsx"
Cohesion: 0.08
Nodes (27): Footer(), FOOTER_COLUMNS, FooterLink, UserDetailForm(), ADMIN_LINK, DASHBOARD_LINK, Header(), HOME_LINK (+19 more)

### Community 40 - "Component Sniping"
Cohesion: 0.10
Nodes (19): 21st.dev — AI-Optimized Components, Aceternity UI — Animated Components, Anti-Patterns, CodePen — Interactive Widgets and Effects, Component Sniping, Converting CodePen to React, Integration Workflow, JavaScript-heavy Pen (+11 more)

### Community 41 - "Stitch DESIGN.md Skill"
Cohesion: 0.10
Nodes (19): 1. Extract Project Identity (JSON), 2. Define the Atmosphere (Image/HTML), 3. Map the Color Palette (Tailwind Config/JSON), 4. Translate Geometry & Shape (CSS/Tailwind), 5. Describe Depth & Elevation, Analysis & Synthesis Instructions, Best Practices, Common Pitfalls to Avoid (+11 more)

### Community 42 - "cn"
Cohesion: 0.40
Nodes (5): Create React App, Framework-Specific Considerations, Next.js App Router, Next.js Pages Router, Vite

### Community 43 - "Atelier Router"
Cohesion: 0.11
Nodes (18): Agent Definitions, Atelier Router, Build Phase Order, Build Skills, Catalog Reference Table, Component Library Skills, Core Skills (Load for every build), How Routing Works (+10 more)

### Community 44 - "Enhance Prompt for Stitch"
Cohesion: 0.11
Nodes (18): A. Add UI/UX Keywords, B. Amplify the Vibe, C. Structure the Page, D. Format Colors Properly, Enhance Prompt for Stitch, Enhancement Pipeline, Example 1: Vague Input → Structured Prompt, Example 2: Feature Request → Targeted Edit (+10 more)

### Community 45 - "Framer Motion"
Cohesion: 0.11
Nodes (18): 3D Card Tilt, Animated Counter, Animation Code Snippets, Character Reveal, CSS-Only Animations, Exit Animation, Float Animation, Framer Motion (+10 more)

### Community 46 - "dependencies"
Cohesion: 0.10
Nodes (21): dependencies, bcrypt, cors, express, express-rate-limit, @getbrevo/brevo, helmet, jsonwebtoken (+13 more)

### Community 47 - "useAuth"
Cohesion: 0.10
Nodes (21): AppConfigData, AppConfigForm(), ToggleRow(), LoginForm(), LoginResponse, RegisterForm(), RegisterResponse, readOnlyInputClassName (+13 more)

### Community 48 - "Framer Motion (Baseline)"
Cohesion: 0.11
Nodes (17): 3D Card Tilt, Animated Counter, Animation Catalog, Cards Stagger on Scroll, Character Reveal, CSS-Only (Baseline), Footer Reveal (Fixed Underlay), Framer Motion (Baseline) (+9 more)

### Community 49 - "Scroll Frames"
Cohesion: 0.11
Nodes (17): Batch conversion script, Checklist Before Shipping, Dependencies, Option A — Real footage, Option B — AI-generated transitions, Performance Best Practices, Pipeline Overview, Resize during extraction (optional) (+9 more)

### Community 50 - "otp.service.ts"
Cohesion: 0.67
Nodes (3): Adding New Animations, Adjusting Existing Animations, Animation Customization

### Community 51 - "components.json"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 52 - "Prompt Anti-Patterns (What NOT to Do)"
Cohesion: 0.12
Nodes (16): Example 1: Light Mode Support Portal, Example 2: Dark Mode Client Dashboard, Mixing Too Many Changes in Iteration, No Emotional Context, Prompt 1A: Dashboard / Home Page, Prompt 1B: Internal Trainer Dashboard, Prompt 2A: Login Page, Prompt 2B: Main Dashboard (+8 more)

### Community 53 - "devDependencies"
Cohesion: 0.10
Nodes (21): devDependencies, prettier, tsx, @types/bcrypt, @types/cors, @types/express, @types/jsonwebtoken, @types/multer (+13 more)

### Community 54 - "Atelier Skills"
Cohesion: 0.12
Nodes (16): Agent Team Pattern, Agents (4), Anti-Slop Rules, Atelier Skills, Catalogs (9), Contributing, License, Quick Start (+8 more)

### Community 55 - "Framer Motion Recipes"
Cohesion: 0.12
Nodes (16): 3D Card Tilt, Animated Counter, Drag with Constraints, Exit Animations, Fade In on Mount, Framer Motion Recipes, Gradient Blob Animation, Hover Lift with Scale (+8 more)

### Community 56 - "Component Catalog"
Cohesion: 0.12
Nodes (15): Animated Stats Row, Cards, Component Catalog, Glass Morphism Card, Hover Reveal Card, Layered Blueprint Map, Logo Bar with Animation (Linear/Resend Pattern), Navigation (+7 more)

### Community 57 - "Typography"
Cohesion: 0.12
Nodes (15): Agency / Consulting / B2B, Checklist, Dashboard / SaaS / Data-Heavy, Discovery Process, Font Discovery (Sniping), Font Loading (FOUT Prevention), Premium / Luxury / Healthcare, Proven Pairings (+7 more)

### Community 58 - "Design Decisions"
Cohesion: 0.12
Nodes (15): Animation Strategy, Anti-Slop Guardrails, Catalog Patterns Used, Color System, Component Patterns, Design Brief: [Project Name], Design Decisions, Hero Archetype (+7 more)

### Community 59 - "Remotion Composition Checklist"
Cohesion: 0.13
Nodes (14): ✅ Animations & Transitions, ✅ Asset Preparation, 📋 Best Practices Verified, 🐛 Common Issues Checked, ✅ Component Structure, ✅ Configuration, ✅ Final Output, 🎨 Optional Enhancements (+6 more)

### Community 60 - "GitHub to Vercel Deployment Pipeline"
Cohesion: 0.13
Nodes (14): 1. Create GitHub Repository, 2. Connect to Vercel, 3. Add vercel.json, 4. Custom Domain (Optional), Active Deployments, First-Time Setup (Per Project), GitHub to Vercel Deployment Pipeline, Image Optimization (Pre-Deploy) (+6 more)

### Community 61 - "AppConfigService"
Cohesion: 0.67
Nodes (3): Dark Mode, Setting Up Dark Mode, Toggle Dark Mode

### Community 62 - "Hero Archetypes"
Cohesion: 0.14
Nodes (13): 1. Split Hero (Text Left + Visual Right), 2. Centered Hero (Full-width text), 3. Full-Bleed Media Hero, 4. Asymmetric Overlap Hero, Background Treatments, Dot Grid Pattern, Gradient Mesh, Hero Archetypes (+5 more)

### Community 63 - "Motion Effects"
Cohesion: 0.14
Nodes (13): Animation Patterns, Basic Fade-In, Best Practices, Cards, Framer Motion Quick Start, Hero Section, Hover Effects, Installation (+5 more)

### Community 64 - "Tailwind CSS v4 Patterns"
Cohesion: 0.14
Nodes (13): Animated Gradient Border, Blur Navigation Bar, Dark Mode Token Structure, Dot Grid Background, Glass Morphism Card, Gradient Mesh Background, Grain Texture Overlay, Logo Bar with Grayscale-to-Color Hover (+5 more)

### Community 65 - "Project Brief: [Project Name]"
Cohesion: 0.14
Nodes (13): Brand Assets, Client, Content, CTA, Design Direction, Notes, Objective, Pages / Sections Required (+5 more)

### Community 66 - "Agent Team Design Workflow"
Cohesion: 0.14
Nodes (13): Agent Team Design Workflow, Concept, Option A: Separate Terminal Sessions, Option B: Claude Code Worktrees, Practical Tips, Prerequisites, Prompt Template for Each Agent, Step 1: Write the Shared Project Brief (+5 more)

### Community 67 - "UserModel"
Cohesion: 0.18
Nodes (9): authenticateByToken(), AppConfigInterface, appConfigSchema, UserInterface, UserModel, userSchema, FakeUser, Express (+1 more)

### Community 68 - "creative-director.md"
Cohesion: 0.15
Nodes (12): AI Design Tools, Anti-AI-Slop Rules (Enforce These), Asset Tools, Communication Style, Design Intelligence, Design Principles, Discovery Tools, Post-Build: Update EXPERTISE.md (+4 more)

### Community 69 - "Proven Pairings (Baseline)"
Cohesion: 0.15
Nodes (12): Animated Underline on Hover, Cabinet Grotesk + Inter, Clash Display + DM Sans, Fraunces + Source Sans 3, Gradient Text, New Finds, Proven Pairings (Baseline), Space Grotesk + JetBrains Mono (+4 more)

### Community 70 - "shadcn/ui Customization Guide"
Cohesion: 0.20
Nodes (10): Advanced Customization, Best Practices, Border Radius, Creating a Design System, Custom Spacing, Design Tokens File, Resources, shadcn/ui Customization Guide (+2 more)

### Community 71 - "Migration Guide to shadcn/ui"
Cohesion: 0.06
Nodes (32): 1. Not Setting Up Tailwind Properly, 2. Forgetting Path Aliases, 3. Trying to Match Old Library Exactly, 4. Not Using Form Libraries, 5. Ignoring Accessibility, After Migration, Before Migration, Common Pitfalls (+24 more)

### Community 72 - "tsconfig.json"
Cohesion: 0.22
Nodes (8): compilerOptions, forceConsistentCasingInFileNames, outDir, rootDir, extends, include, src/**/*.ts, @tsconfig/node22/tsconfig.json

### Community 73 - "package.json"
Cohesion: 0.15
Nodes (12): dependencies, @swc/core, description, engines, node, name, scripts, fetch (+4 more)

### Community 74 - "index.tsx"
Cohesion: 0.67
Nodes (3): Font Family, Font Sizes, Typography Customization

### Community 76 - "Example Directive: Website Build"
Cohesion: 0.17
Nodes (11): Brand/Style, Constraints, Example Directive: Website Build, Goal, Learnings, Page 1: Home (/), Page 2: About (/about), Page 3: Contact (/contact) (+3 more)

### Community 77 - "api.ts"
Cohesion: 0.50
Nodes (4): Option 1: npx shadcn create (Recommended), Option 2: Classic Manual Setup (Next.js), Option 3: Classic Manual Setup (Vite + React), Quick Start (New Project)

### Community 78 - "UI Reviewer Agent"
Cohesion: 0.18
Nodes (10): Accessibility Check, Anti-Slop Check, Output Format, Responsive Check, Review Checklist, Role, Screenshot Tool, Skills to Load (+2 more)

### Community 79 - "Google Stitch Mastery Guide"
Cohesion: 0.18
Nodes (10): Anti-"AI Slop" Rules, Completed Projects, Design Token Seeding, Example Project History with Stitch, Google Stitch Mastery Guide, Prompt Length Rules, Quality Checklist (Run After Every Generation), Stitch Project References (+2 more)

### Community 80 - "Stitch SDK Integration (Recommended)"
Cohesion: 0.18
Nodes (11): Available Tools (SDK + MCP), Iterative Editing Workflow (SDK), MCP Legacy Setup (Still Works), Optimal Pipeline (with Claude Code Skills), SDK MCP Proxy, SDK Quick Reference, SDK Validation, SDK vs MCP (+3 more)

### Community 81 - "Lessons from a 10-Screen Dashboard Build"
Cohesion: 0.18
Nodes (11): Charts Are Placeholder-Quality Only, Glass Morphism Token Values That Actually Work, KPI Card Pattern That Works, Layout Shell Bug: min-h-screen vs h-screen (CRITICAL), Lessons from a 10-Screen Dashboard Build, Noise/Grain Overlay Opacity, Prompt Length Confirmation, Screenshot Fuzziness is Not a Code Issue (+3 more)

### Community 82 - "Design Scout"
Cohesion: 0.18
Nodes (10): Design Scout, Integration with Creative Director, Output Format, Scout Protocol, Step 1: Check Component Library Updates (~3 min), Step 2: Industry-Specific Trends (~3 min), Step 3: Premium Technique Discovery (~3 min), Step 4: Open Source Dashboard Audit (~2 min) (+2 more)

### Community 83 - "Reference Analysis"
Cohesion: 0.18
Nodes (10): Checklist, Ethical Boundaries, Phase 1: Find References, Phase 2: Analyze the Reference, Phase 3: Extract Brand (for Redesigns), Phase 4: Adapt + Differentiate, Reference Analysis, Sources (by quality) (+2 more)

### Community 84 - "Form Components"
Cohesion: 0.18
Nodes (11): Button, Checkbox, Form, Form Components, Input, Label, Radio Group, Select (+3 more)

### Community 85 - "[Client Name] Brand Guidelines"
Cohesion: 0.18
Nodes (10): [Client Name] Brand Guidelines, Colors, Content, CTA Language, Reference Sites, Tagline, Typography, Value Propositions (+2 more)

### Community 86 - "package.json"
Cohesion: 0.18
Nodes (10): dependencies, @google/stitch-sdk, description, name, scripts, proxy, validate, type (+2 more)

### Community 88 - "frontend-builder.md"
Cohesion: 0.20
Nodes (9): Animation Rules (Framer Motion), Anti-AI-Slop Checklist (Verify Before Completing), Code Quality Rules, Color Rules, Post-Build, Responsibilities, Startup Sequence, Tech Stack (+1 more)

### Community 89 - "router.tsx"
Cohesion: 0.23
Nodes (12): AdminUserDetailOutDto, AdminUserOutDto, UpdateAdminUserDto, USER_ROLES, UserRole, AppConfigPayload, AdminService, toAdminUser() (+4 more)

### Community 90 - "Color Catalog"
Cohesion: 0.20
Nodes (9): AI Authority Dark (Ciridae Pattern), Color Catalog, Dark Mode Structure, Developer Clean (Resend Pattern), Gradient Accent Strategy (Linear Pattern), Healthcare Palettes, New Finds, Ocean Professional (Medical SaaS) (+1 more)

### Community 91 - "Overlay Components"
Cohesion: 0.20
Nodes (10): Alert Dialog, Context Menu, Dialog, Dropdown Menu, Hover Card, Menubar, Overlay Components, Popover (+2 more)

### Community 92 - "shadcn/ui Component Catalog"
Cohesion: 0.20
Nodes (10): Combobox, Command, Command & Search, Component Updates, Date Picker, Date & Time, Further Reading, Installation Shortcuts (+2 more)

### Community 94 - "Fedier template"
Cohesion: 0.18
Nodes (9): Frontend, Commands, Environment, Fedier template, Layout, Plans, Run it locally, Security notes (+1 more)

### Community 95 - "Common Stitch Issues & Fixes"
Cohesion: 0.22
Nodes (9): Common Stitch Issues & Fixes, Problem: Charts Look Wrong, Problem: Colors Drift, Problem: Elements Dropped, Problem: Gradient Orbs Not Rendering, Problem: Icons Not Matching, Problem: Missing Glass Morphism, Problem: Too Symmetrical / Generic (+1 more)

### Community 96 - "GSAP Recipes"
Cohesion: 0.22
Nodes (8): Character Reveal, GSAP Recipes, Horizontal Scroll Section, Scroll-Triggered Text Reveal (Line by Line), ScrollTrigger Pin Section, SVG Path Draw Animation, Text Scramble Effect, Timeline Sequences

### Community 97 - "package.json"
Cohesion: 0.22
Nodes (8): dependencies, puppeteer, description, main, name, private, version, puppeteer

### Community 99 - "Stitch to React Components"
Cohesion: 0.25
Nodes (7): Architectural rules, Execution steps, Option A: SDK (preferred), Option B: MCP (legacy), Retrieval and networking, Stitch to React Components, Troubleshooting

### Community 100 - "screenshot.js"
Cohesion: 0.29
Nodes (6): flags, fs, path, puppeteer, screenshot(), scrollThroughPage()

### Community 101 - "package.json"
Cohesion: 0.25
Nodes (7): author, description, keywords, license, name, type, version

### Community 102 - "scripts"
Cohesion: 0.25
Nodes (8): scripts, build, dev, format, format:check, start, test, type-check

### Community 103 - "SandboxChatForm.tsx"
Cohesion: 0.16
Nodes (17): AuthContext, AuthContextValue, AuthProvider(), AuthUser, bootstrapAuth(), clearToken(), fetchValidatedUser(), invalidateAuthCache() (+9 more)

### Community 104 - "page-builder.md"
Cohesion: 0.29
Nodes (6): Responsibilities, Screenshot QA, Skills to Load, Startup Sequence, Tech Stack, What You Do NOT Do

### Community 105 - "Data Display"
Cohesion: 0.29
Nodes (7): Avatar, Badge, Calendar, Data Display, Progress, Skeleton, Table

### Community 106 - "Brand Assets Template"
Cohesion: 0.29
Nodes (6): Brand Assets Template, Claude Code Integration, File Naming Convention, How to Populate, Optional, Required

### Community 107 - "The Prompt Formula"
Cohesion: 0.33
Nodes (6): 1. Context & Purpose (2-3 sentences), 2. Design Direction (1-2 sentences), 3. Layout Structure (the bulk of the prompt), 4. Content & Data, 5. Interactive States & Overall Feel, The Prompt Formula

### Community 108 - "Layout Components"
Cohesion: 0.33
Nodes (6): Accordion, Card, Collapsible, Layout Components, Separator, Tabs

### Community 110 - "ListPagination.tsx"
Cohesion: 0.12
Nodes (19): Draft, EMPTY_DRAFT, PlansAdminForm(), EndChoice, Mode, Props, PlanBadge(), Button() (+11 more)

### Community 112 - "Prompt Templates"
Cohesion: 0.40
Nodes (5): Dark SaaS Dashboard Template, Landing Page Section Template, Light SaaS / Portal Template, Mobile App Screen Template, Prompt Templates

### Community 113 - "Component Composition Patterns"
Cohesion: 0.40
Nodes (5): Authentication Pattern, Component Composition Patterns, Dashboard Layout Pattern, Data Table Pattern, Form + Validation Pattern

### Community 115 - "Architecture Quality Gate"
Cohesion: 0.40
Nodes (4): Architecture Quality Gate, Structural integrity, Styling and theming, Type safety and syntax

### Community 116 - "tsconfig.build.json"
Cohesion: 0.40
Nodes (4): exclude, extends, src/**/*.test.ts, ./tsconfig.json

### Community 117 - "Export & Handoff"
Cohesion: 0.50
Nodes (4): Export & Handoff, From Stitch to React, Stitch -> Code Tool -> Deploy Pipeline, What Stitch Gives You vs What You Build

### Community 118 - "Iteration Workflow"
Cohesion: 0.50
Nodes (4): Iteration Prompt Rules, Iteration Workflow, The Generate -> Review -> Iterate -> Export Loop, When to Use Which Tool

### Community 119 - "Screen Generation Strategy"
Cohesion: 0.50
Nodes (4): One Screen at a Time, Order Matters, Reference Previous Screens, Screen Generation Strategy

### Community 122 - "SideDrawer.tsx"
Cohesion: 0.05
Nodes (36): LoginInDto, LoginOutDto, RegisterInDto, RegisterOutDto, ResetPasswordInDto, ResetPasswordOutDto, SendOtpInDto, env (+28 more)

### Community 124 - "Feedback Components"
Cohesion: 0.50
Nodes (4): Alert, Feedback Components, Sonner, Toast

### Community 125 - "Utility Components"
Cohesion: 0.50
Nodes (4): Aspect Ratio, Resizable, Scroll Area, Utility Components

### Community 126 - "Navigation"
Cohesion: 0.50
Nodes (4): Breadcrumb, Navigation, Navigation Menu, Pagination

### Community 132 - "Stitch API reference"
Cohesion: 0.50
Nodes (3): Metadata schema, Stitch API reference, Technical mapping rules

### Community 133 - "CLAUDE.md"
Cohesion: 0.50
Nodes (3): 🌍 Always-Apply Rules (Global Context), 🎯 Auto-Select Rules (File-Specific), Project Notes

### Community 135 - "Advanced Components"
Cohesion: 0.67
Nodes (3): Advanced Components, Carousel, Drawer

### Community 145 - "validate.js"
Cohesion: 0.12
Nodes (22): log(), run(), describeEnd(), UserPlanForm(), ProfileForm(), Block, blockFrom(), describeRange() (+14 more)

## Knowledge Gaps
- **1162 isolated node(s):** `ScreenSlideProps`, `download-stitch-asset.sh script`, `User`, `data`, `columns` (+1157 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `RolesAdminForm.tsx` to `SandboxChatForm.tsx`, `brandingContext.tsx`, `ListPagination.tsx`, `useAuth`, `validate.js`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **Why does `shadcn/ui Component Catalog` connect `shadcn/ui Component Catalog` to `Advanced Components`, `Data Display`, `Layout Components`, `Component Composition Patterns`, `Form Components`, `login.tsx`, `Overlay Components`, `Feedback Components`, `Utility Components`, `Navigation`?**
  _High betweenness centrality (0.003) - this node is a cross-community bridge._
- **Why does `UserModel` connect `UserModel` to `router.tsx`, `SideDrawer.tsx`, `index.ts`, `app-config.tsx`?**
  _High betweenness centrality (0.003) - this node is a cross-community bridge._
- **What connects `ScreenSlideProps`, `download-stitch-asset.sh script`, `User` to the rest of the system?**
  _1162 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `parseApiKeyId` be split into smaller, more focused modules?**
  _Cohesion score 0.04878048780487805 - nodes in this community are weakly interconnected._
- **Should `utils.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05555555555555555 - nodes in this community are weakly interconnected._
- **Should `index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05465346534653465 - nodes in this community are weakly interconnected._