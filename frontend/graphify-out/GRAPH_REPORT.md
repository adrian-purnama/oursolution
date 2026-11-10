# Graph Report - frontend (2026-09-12)

## Corpus Check

- 199 files · ~116,458 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary

- 1507 nodes · 3661 edges · 70 communities (62 shown, 8 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 50 edges (avg confidence: 0.52)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)

- routeTree.gen.ts
- article.ts
- devDependencies
- dependencies
- McpSection.tsx
- WidgetRuntimeContext.tsx
- GuidanceContentEditor.tsx
- job.ts
- compilerOptions
- utils.ts
- widget.ts
- articleContent.ts
- contentReferences.ts
- TrainTestAgentPanel.tsx
- ProjectSidebar.tsx
- PlansAdminForm.tsx
- ProjectSectionPlaceholder.tsx
- utils.ts
- HomeCanvasRenderer.tsx
- brandingContext.tsx
- GuidanceSection.tsx
- FileRoutesByPath
- ApiKeysSection.tsx
- WidgetBuilder.tsx
- components.json
- UsersAdminForm.tsx
- SandboxChatForm.tsx
- SandboxOcrForm.tsx
- TranslateLanguageCombobox.tsx
- Building For Production
- TopicRichEditor.tsx
- ui-classes.ts
- authContext.tsx
- agent.ts
- cn
- VariableReferencePicker.tsx
- ToggleRow.tsx
- planContext.tsx
- quillTopicRef.ts
- command.tsx
- WidgetApp.tsx
- ArticleDrawer.tsx
- index.tsx
- route.tsx
- chat.tsx
- HomeCanvasBuilder.tsx
- WidgetArticleReader.tsx
- JsonTemplateBuilder.tsx
- SideDrawer.tsx
- HomeChromeUploads.tsx
- router.tsx
- reset-password.tsx
- article.tsx
- guidance.tsx
- widget.tsx
- jobs.tsx
- plans.tsx
- route.tsx
- login.tsx
- register.tsx
- index.tsx
- mcp.tsx
- route.tsx
- route.tsx
- $publicKey.tsx
- AGENTS.md
- prettier.config.js
- vite.config.ts
- route.tsx

## God Nodes (most connected - your core abstractions)

1. `cn()` - 268 edges
2. `apiFetch()` - 93 edges
3. `FileRoutesByPath` - 42 edges
4. `parseContentToBlocks()` - 25 edges
5. `serializeContentBlocks()` - 24 edges
6. `usePlan()` - 23 edges
7. `getToken()` - 18 edges
8. `widgetPublicMediaPath()` - 18 edges
9. `useWidgetRuntime()` - 17 edges
10. `compilerOptions` - 17 edges

## Surprising Connections (you probably didn't know these)

- `CalendarDayButton()` --references--> `react` [EXTRACTED]
  src/components/ui/calendar.tsx → package.json
- `AgentChatThread()` --calls--> `cn()` [EXTRACTED]
  src/components/agentChat/AgentChatThread.tsx → src/lib/utils.ts
- `SparklineRow()` --calls--> `cn()` [EXTRACTED]
  src/components/analyze/AnalyticsExplorer.tsx → src/lib/utils.ts
- `MetricCard()` --calls--> `cn()` [EXTRACTED]
  src/components/analyze/AnalyzeGapsSection.tsx → src/lib/utils.ts
- `MetricCard()` --calls--> `cn()` [EXTRACTED]
  src/components/analyze/AnalyzePerformanceSection.tsx → src/lib/utils.ts

## Import Cycles

- None detected.

## Communities (70 total, 8 thin omitted)

### Community 0 - "routeTree.gen.ts"

Cohesion: 0.03
Nodes (68): getRouter(), Register, @tanstack/react-router, Route, Route, AdminAppConfigRoute, AdminIndexRoute, AdminJobsRoute (+60 more)

### Community 1 - "article.ts"

Cohesion: 0.08
Nodes (45): AuthAgentChatImage(), ArticlesSection(), ArticlesSectionProps, ArticlesSkeleton(), IconAction(), rollupSyncStatus(), StatusPill(), SyncPill() (+37 more)

### Community 2 - "devDependencies"

Cohesion: 0.05
Nodes (43): eslint, devDependencies, eslint, prettier, @tailwindcss/typography, @tanstack/devtools-vite, @tanstack/eslint-config, @tanstack/router-cli (+35 more)

### Community 3 - "dependencies"

Cohesion: 0.04
Nodes (45): class-variance-authority, clsx, cmdk, date-fns, lucide-react, marked, dependencies, class-variance-authority (+37 more)

### Community 4 - "McpSection.tsx"

Cohesion: 0.13
Nodes (23): AUTH_TYPE_LABELS, IconAction(), McpSection(), McpSectionProps, McpSkeleton(), StatusPill(), SyncStatusPill(), TRANSPORT_LABELS (+15 more)

### Community 5 - "WidgetRuntimeContext.tsx"

Cohesion: 0.22
Nodes (11): useWidgetRuntime(), FaqPage(), HomePage(), NewsPage(), WidgetChromeActions(), WidgetChromeActionsProps, WidgetPanel(), getPublicNewsList() (+3 more)

### Community 6 - "GuidanceContentEditor.tsx"

Cohesion: 0.09
Nodes (37): COMMON_TIMEZONES, dateFromYmd(), MeetingTopicDrawer(), MeetingTopicDrawerProps, pad2(), StatusPill(), ymdFromDate(), BookMeetingConflict (+29 more)

### Community 7 - "job.ts"

Cohesion: 0.15
Nodes (19): createChatJob(), CreateChatJobInput, CreateChatJobOut, createOcrJob(), CreateOcrJobOut, createTranslateJob(), CreateTranslateJobOut, getJob() (+11 more)

### Community 8 - "compilerOptions"

Cohesion: 0.07
Nodes (27): DOM, DOM.Iterable, ES2022, eslint.config.js, prettier.config.js, **/_.ts, \**/_.tsx, vite/client (+19 more)

### Community 9 - "utils.ts"

Cohesion: 0.12
Nodes (20): JsonFieldRow(), JsonFieldRowProps, JsonTemplateBuilder(), JsonTemplateBuilderProps, Select(), SelectContent(), SelectItem(), SelectLabel() (+12 more)

### Community 10 - "widget.ts"

Cohesion: 0.06
Nodes (40): embedSrc(), HostWidgetEmbed(), HostWidgetEmbedProps, sectionCardClass(), WidgetFaqList(), WidgetFaqListProps, ButtonTextAlign, createVisitorJwt() (+32 more)

### Community 11 - "articleContent.ts"

Cohesion: 0.11
Nodes (22): escapeAttr(), sanitizeArticleHtml(), topicBodyHtml(), WidgetArticleReader(), WidgetArticleReaderProps, TopicEditorBlock, TopicImageBlock, TopicTextBlock (+14 more)

### Community 12 - "contentReferences.ts"

Cohesion: 0.12
Nodes (29): reconcileSavePayloadWithEditorDelta(), applyVarBindings(), attr(), ContentBlock, defaultToolAlias(), formatImageRef(), formatToolVariableRef(), formatVarRef() (+21 more)

### Community 13 - "TrainTestAgentPanel.tsx"

Cohesion: 0.06
Nodes (59): agentMarkdownToHtml(), agentProseClassName(), newAgentChatMessageId(), sanitizeHtml(), stripUiMarkers(), AgentChatThread(), AgentChatThreadProps, AgentChatImageRenderer (+51 more)

### Community 14 - "ProjectSidebar.tsx"

Cohesion: 0.07
Nodes (35): ApiKeysSection(), ApiKeysSkeleton(), ProjectSettings(), ProjectSettingsProps, isGroupActive(), isNavLinkActive(), navGroupButtonClass, NavGroupItem() (+27 more)

### Community 15 - "PlansAdminForm.tsx"

Cohesion: 0.06
Nodes (61): PickerTool, ToolReferencePicker(), ToolReferencePickerProps, schemaFieldPaths(), VariableOption, VariableReferencePicker(), VariableReferencePickerProps, LiveAgentDashboard() (+53 more)

### Community 16 - "ProjectSectionPlaceholder.tsx"

Cohesion: 0.17
Nodes (5): ProjectSectionPlaceholder(), ProjectSectionPlaceholderProps, Route, Route, Route

### Community 17 - "utils.ts"

Cohesion: 0.22
Nodes (14): DraggableInsert(), VariableSidebar(), VariableSidebarProps, buildExampleJson(), buildExampleValue(), collectPathsFromNode(), collectVariablePaths(), collectVariables() (+6 more)

### Community 18 - "HomeCanvasRenderer.tsx"

Cohesion: 0.31
Nodes (7): HomeSections(), HomeSectionsProps, sectionCardClass(), SectionContent(), WidgetNewsCard(), WidgetNewsCardProps, PublicNewsListItem

### Community 19 - "brandingContext.tsx"

Cohesion: 0.13
Nodes (17): Footer(), FOOTER_COLUMNS, AppConfigData, AppConfigForm(), ToggleRow(), Header(), NAV_LINKS, bootstrapBranding() (+9 more)

### Community 20 - "GuidanceSection.tsx"

Cohesion: 0.11
Nodes (19): JobsAdminForm(), RunJobWorkerResult, FeatureShowcase(), RECENT_ACTIVITY, CommandDialog(), DialogContent(), DialogDescription(), DialogFooter() (+11 more)

### Community 21 - "FileRoutesByPath"

Cohesion: 0.06
Nodes (14): Route, Route, Route, Route, Route, Route, Route, Route (+6 more)

### Community 22 - "ApiKeysSection.tsx"

Cohesion: 0.15
Nodes (11): ACCESS_MODE_LABELS, BadgeImageField(), CopyField(), WidgetConfigurationForm(), WidgetConfigurationFormProps, VISITOR_JWT_ALGORITHM_VALUES, VisitorJwtAlgorithm, visitorJwtAudience() (+3 more)

### Community 23 - "WidgetBuilder.tsx"

Cohesion: 0.16
Nodes (20): ArticleViewState, ChatView, NewsViewState, WidgetPanelSettings, WidgetRuntimeContext, WidgetRuntimeContextValue, WidgetRuntimeProvider(), WidgetRuntimeProviderProps (+12 more)

### Community 24 - "components.json"

Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 25 - "UsersAdminForm.tsx"

Cohesion: 0.09
Nodes (46): AnalyticsExplorer(), AnalyticsExplorerProps, formatShortDate(), layoutTreemap(), SparklineRow(), TILE_COLORS, TreemapItem, AnalyzeGapsSection() (+38 more)

### Community 26 - "SandboxChatForm.tsx"

Cohesion: 0.21
Nodes (14): buildChatRequestBody(), buildCodeExamples(), CodeLang, createMessageRow(), escapeForSingleQuotes(), MessageRow, SandboxChatForm(), SandboxChatFormProps (+6 more)

### Community 27 - "SandboxOcrForm.tsx"

Cohesion: 0.21
Nodes (15): buildCodeExamples(), CodeLang, escapeForSingleQuotes(), ImageInputMode, OCR_PROMPT_OPTIONS, SandboxOcrForm(), SandboxOcrFormProps, buildOcrMessages() (+7 more)

### Community 28 - "TranslateLanguageCombobox.tsx"

Cohesion: 0.22
Nodes (15): formatLanguageLabel(), TranslateLanguageCombobox(), TranslateLanguageComboboxProps, Command(), CommandEmpty(), CommandGroup(), CommandInput(), CommandItem() (+7 more)

### Community 29 - "Building For Production"

Cohesion: 0.12
Nodes (15): Adding A Route, Adding Links, API Routes, Building For Production, Data Fetching, Demo files, Getting Started, Learn More (+7 more)

### Community 30 - "TopicRichEditor.tsx"

Cohesion: 0.12
Nodes (21): BUILDER_TABS, BuilderTab, BuilderTabMeta, WIDGET_TAB_META, WidgetTabMeta, WidgetTab, WidgetFaqForm(), WidgetFaqFormProps (+13 more)

### Community 31 - "ui-classes.ts"

Cohesion: 0.22
Nodes (14): IconAction(), SnippetsSection(), SnippetsSectionProps, SnippetsSkeleton(), StatusPill(), SyncPill(), TopicSyncStatus, createSnippet() (+6 more)

### Community 32 - "authContext.tsx"

Cohesion: 0.23
Nodes (10): AuthContext, AuthContextValue, AuthProvider(), AuthUser, bootstrapAuth(), clearToken(), fetchValidatedUser(), invalidateAuthCache() (+2 more)

### Community 33 - "agent.ts"

Cohesion: 0.67
Nodes (4): Button(), buttonVariants, Calendar(), CalendarDayButton()

### Community 34 - "cn"

Cohesion: 0.16
Nodes (20): Draft, emptyDraft(), formatDate(), WidgetNewsForm(), WidgetNewsFormProps, createNews(), CreateNewsInput, deleteNews() (+12 more)

### Community 35 - "VariableReferencePicker.tsx"

Cohesion: 0.22
Nodes (9): previewMediaUrl(), fetchOwnedPreviewUrl(), HomeChromeUploadsProps, MediaSlot(), getToken(), apiUpload(), uploadNewsMedia(), uploadWidgetMedia() (+1 more)

### Community 36 - "ToggleRow.tsx"

Cohesion: 0.40
Nodes (4): ToggleRow(), ToggleRowProps, WidgetChatForm(), WidgetChatFormProps

### Community 37 - "planContext.tsx"

Cohesion: 0.09
Nodes (23): FIELD_HELP, HelpKey, PlansAdminForm(), ToggleRow(), fetchUserPlan(), PlanContext, PlanContextValue, PlanProvider() (+15 more)

### Community 38 - "quillTopicRef.ts"

Cohesion: 0.50
Nodes (3): ArticleSearch, Route, TrainArticlesPage()

### Community 39 - "command.tsx"

Cohesion: 0.24
Nodes (17): MeetingByDateView(), MeetingByDateViewProps, MeetingCalendarView(), MeetingCalendarViewProps, MeetingRow(), MeetingRowProps, addDaysYmd(), attendeeSummary() (+9 more)

### Community 40 - "WidgetApp.tsx"

Cohesion: 0.18
Nodes (19): ApplySessionFn, SessionState, usePublicWidgetSession(), UsePublicWidgetSessionOptions, readQueryVisitorToken(), useVisitorTokenBridge(), UseVisitorTokenBridgeOptions, bindPublicVisitorIdentity() (+11 more)

### Community 41 - "ArticleDrawer.tsx"

Cohesion: 0.20
Nodes (14): GuidanceDrawer(), GuidanceDrawerProps, StatusPill(), GuidanceSection(), GuidanceSectionProps, GuidanceSkeleton(), IconAction(), StatusPill() (+6 more)

### Community 42 - "index.tsx"

Cohesion: 0.22
Nodes (5): FinalCta(), HeroSection(), TRUST_ROW_1, TRUST_ROW_2, Route

### Community 43 - "route.tsx"

Cohesion: 0.08
Nodes (51): allowBlobImageSrc(), QuillEditorApi, QuillProps, ReactQuillHandle, ReadOnlyBlocks(), SelectedImage, TOOLBAR, TopicRichEditor() (+43 more)

### Community 44 - "chat.tsx"

Cohesion: 0.10
Nodes (10): CAPABILITY_LABELS, formatCapabilityList(), SandboxCapabilityGate(), SandboxCapabilityGateProps, Route, Route, projectRouteApi, Route (+2 more)

### Community 45 - "HomeCanvasBuilder.tsx"

Cohesion: 0.13
Nodes (17): WidgetFormSection(), WidgetFormSectionProps, WidgetHomeForm(), WidgetHomeFormProps, ElementInspector(), ElementInspectorProps, ElementPalette(), ElementPaletteProps (+9 more)

### Community 46 - "WidgetArticleReader.tsx"

Cohesion: 0.19
Nodes (20): apiFetch(), addBatchTestQuestion(), BatchTestAnswerability, BatchTestGroup, BatchTestGroupDetail, BatchTestGroupProgress, BatchTestGroupRunStatus, BatchTestQuestion (+12 more)

### Community 47 - "JsonTemplateBuilder.tsx"

Cohesion: 0.12
Nodes (18): ANSWERABILITY_FILTERS, AnswerabilityChip(), AnswerabilityFilter, BatchTestSection(), BatchTestSectionProps, ChipDot(), IconAction(), InfluenceSection() (+10 more)

### Community 48 - "SideDrawer.tsx"

Cohesion: 0.17
Nodes (9): SnippetDrawerProps, StatusPill(), SyncPill(), BODY_SIZE, PANEL_SIZE, PANEL_SIZE_WITH_DETAILS, SideDrawer(), SideDrawerProps (+1 more)

### Community 49 - "HomeChromeUploads.tsx"

Cohesion: 0.14
Nodes (16): ChatPage(), WidgetChatList(), WidgetChatListProps, LiveChatMessage, newId(), WidgetLiveAgentChat(), WidgetLiveAgentChatProps, connectVisitorLiveAgentSocket() (+8 more)

### Community 50 - "router.tsx"

Cohesion: 0.17
Nodes (12): MeetingListViewProps, MeetingToolSection(), MeetingToolSectionProps, mergeMeetings(), UPCOMING_VIEWS, UpcomingView, calendarMonthRange(), isUpcoming() (+4 more)

### Community 51 - "reset-password.tsx"

Cohesion: 0.30
Nodes (14): addDaysYmd(), dateToYmd(), dowForYmd(), isWeeklyOpenDay(), monthBounds(), pad2(), parseYmd(), slotChipLabel() (+6 more)

### Community 52 - "article.tsx"

Cohesion: 0.23
Nodes (12): buildCodeExamples(), CodeLang, escapeForSingleQuotes(), SandboxTranslateForm(), SandboxTranslateFormProps, CreateTranslateJobInput, fetchTranslateLanguages(), JobOut (+4 more)

### Community 54 - "widget.tsx"

Cohesion: 0.23
Nodes (12): TopicChip(), formatTopicRef(), insertTopicRefAt(), buildTopicChipElement(), DeltaLike, DeltaOp, fillChip(), plainTextToDeltaOps() (+4 more)

### Community 55 - "jobs.tsx"

Cohesion: 0.20
Nodes (7): ArticleDrawerProps, StatusPill(), SyncPill(), DrawerDetails(), DrawerDetailsProps, formatRelativeTime(), ArticleSyncStatus

### Community 56 - "plans.tsx"

Cohesion: 0.08
Nodes (19): LoginForm(), LoginResponse, PasswordInput(), PasswordInputProps, RegisterForm(), RegisterResponse, readOnlyInputClassName, ResetPasswordForm() (+11 more)

### Community 57 - "route.tsx"

Cohesion: 0.22
Nodes (9): McpDrawer(), McpDrawerProps, parseSchemaProperties(), SchemaProperty, schemaTypeLabel(), StatusPill(), SyncStatusPill(), ToolSchemaDetails() (+1 more)

### Community 58 - "login.tsx"

Cohesion: 0.25
Nodes (6): LiveAgentAvatar(), LiveAgentAvatarProps, sizeClass, LiveAgentDrawer(), LiveAgentDrawerProps, StatusPill()

### Community 59 - "register.tsx"

Cohesion: 0.25
Nodes (8): allowBlobImageSrc(), NewsRichEditor(), NewsRichEditorProps, QuillEditorApi, QuillProps, ReactQuillHandle, TOOLBAR, stampNewsImageMediaIds()

### Community 60 - "index.tsx"

Cohesion: 0.31
Nodes (4): UsersAdminForm(), AdminUser, useDebouncedValue(), Route

### Community 61 - "mcp.tsx"

Cohesion: 0.39
Nodes (7): sanitizeNewsHtml(), WidgetNewsReader(), WidgetNewsReaderProps, getPublicNews(), newsHtmlWithPublicSrcs(), PublicNewsDetail, widgetPublicMediaPath()

## Knowledge Gaps

- **414 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+409 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** run `graphify query` to explore isolated nodes.

## Suggested Questions

_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `GuidanceSection.tsx` to `article.ts`, `McpSection.tsx`, `WidgetRuntimeContext.tsx`, `GuidanceContentEditor.tsx`, `utils.ts`, `widget.ts`, `articleContent.ts`, `TrainTestAgentPanel.tsx`, `ProjectSidebar.tsx`, `PlansAdminForm.tsx`, `ProjectSectionPlaceholder.tsx`, `utils.ts`, `HomeCanvasRenderer.tsx`, `brandingContext.tsx`, `ApiKeysSection.tsx`, `WidgetBuilder.tsx`, `UsersAdminForm.tsx`, `SandboxChatForm.tsx`, `SandboxOcrForm.tsx`, `TranslateLanguageCombobox.tsx`, `TopicRichEditor.tsx`, `ui-classes.ts`, `agent.ts`, `cn`, `VariableReferencePicker.tsx`, `ToggleRow.tsx`, `planContext.tsx`, `quillTopicRef.ts`, `command.tsx`, `ArticleDrawer.tsx`, `route.tsx`, `HomeCanvasBuilder.tsx`, `JsonTemplateBuilder.tsx`, `SideDrawer.tsx`, `HomeChromeUploads.tsx`, `router.tsx`, `reset-password.tsx`, `article.tsx`, `widget.tsx`, `jobs.tsx`, `plans.tsx`, `route.tsx`, `login.tsx`, `register.tsx`, `index.tsx`, `mcp.tsx`?**
  _High betweenness centrality (0.444) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `devDependencies`?**
  _High betweenness centrality (0.108) - this node is a cross-community bridge._
- **Why does `CalendarDayButton()` connect `agent.ts` to `dependencies`, `GuidanceSection.tsx`?**
  _High betweenness centrality (0.107) - this node is a cross-community bridge._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _414 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `routeTree.gen.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0297339593114241 - nodes in this community are weakly interconnected._
- **Should `article.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08163265306122448 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.045454545454545456 - nodes in this community are weakly interconnected._
