# Chaptr Web Parity Specification

This document serves as the exhaustive functional and technical reference for porting the Chaptr mobile app to a web application. It outlines navigation structures, data models, APIs, design systems, core user flows, and web-specific architectural requirements.

---

## 1. Screen Inventory

The screen navigation structures are configured within the main [App.tsx](file:///Users/devops/Desktop/Chaptr/App.tsx) container using `@react-navigation/native` stacks and tab navigators.

### 1.1 Authentication Stack (Public / Unauthenticated)
These screens are defined in [AuthNavigator.tsx](file:///Users/devops/Desktop/Chaptr/src/navigation/AuthNavigator.tsx) and are public-facing.

#### Welcome Screen
- **File Path**: [WelcomeScreen.tsx](file:///Users/devops/Desktop/Chaptr/src/screens/auth/WelcomeScreen.tsx)
- **Route / URL Params**: `/welcome` (represented by `Welcome`)
- **Access Roles**: Public / Unauthenticated
- **Key UI Elements**: App logo, marketing slider / typography, "Get Started" primary button, "Sign In" secondary button.
- **Data Reads**: None
- **Data Writes**: None
- **Navigations**:
  - **From**: App root (when user has no valid session token)
  - **To**: `SignUp`, `SignIn`

#### Sign In Screen
- **File Path**: [SignInScreen.tsx](file:///Users/devops/Desktop/Chaptr/src/screens/auth/SignInScreen.tsx)
- **Route / URL Params**: `/signin` (represented by `SignIn`)
- **Access Roles**: Public / Unauthenticated
- **Key UI Elements**: Email address & Password form, Google OAuth button, Apple OAuth button, "Forgot Password" link, validation error toast.
- **Data Reads**: None
- **Data Writes**: Calls `supabase.auth.signInWithPassword` or `signInWithProvider`.
- **Navigations**:
  - **From**: `Welcome`, `SignUp`
  - **To**: `SignUp`, `MainTabs` (after authentication)

#### Sign Up Screen
- **File Path**: [SignUpScreen.tsx](file:///Users/devops/Desktop/Chaptr/src/screens/auth/SignUpScreen.tsx)
- **Route / URL Params**: `/signup` (represented by `SignUp`)
- **Access Roles**: Public / Unauthenticated
- **Key UI Elements**: Display name input, Email & Password input fields, Terms and Conditions checkbox, Submit form CTA.
- **Data Reads**: None
- **Data Writes**: Calls `supabase.auth.signUp`.
- **Navigations**:
  - **From**: `Welcome`, `SignIn`
  - **To**: `SignIn`, `OnboardingUsername` (upon email creation/session start)

---

### 1.2 Onboarding Stack (Authenticated, Incomplete Profile)
These screens guide a user whose profile has not yet completed initial setup. Defined in [OnboardingNavigator.tsx](file:///Users/devops/Desktop/Chaptr/src/navigation/OnboardingNavigator.tsx).

#### Onboarding Welcome Screen
- **File Path**: [OnboardingWelcomeScreen.tsx](file:///Users/devops/Desktop/Chaptr/src/screens/onboarding/OnboardingWelcomeScreen.tsx)
- **Route / URL Params**: `OnboardingWelcome`
- **Access Roles**: Authenticated onboarding user
- **Key UI Elements**: Narrative animation, greeting text, "Next" navigation button.
- **Data Reads**: None
- **Data Writes**: None
- **Navigations**:
  - **From**: `SignUp`
  - **To**: `OnboardingPromise`

#### Onboarding Username Screen
- **File Path**: [OnboardingUsernameScreen.tsx](file:///Users/devops/Desktop/Chaptr/src/screens/onboarding/OnboardingUsernameScreen.tsx)
- **Route / URL Params**: `OnboardingUsername` (`{ userId: string; email: string }`)
- **Access Roles**: Authenticated onboarding user
- **Key UI Elements**: Custom text input, availability checking loader, validation badge.
- **Data Reads**: Calls `check_username_availability` database RPC helper.
- **Data Writes**: Updates the `users` table with chosen `username`.
- **Navigations**:
  - **From**: `OnboardingWelcome`
  - **To**: `OnboardingBookSelection`

#### Onboarding Book Selection Screen
- **File Path**: [OnboardingBookSelectionScreen.tsx](file:///Users/devops/Desktop/Chaptr/src/screens/onboarding/OnboardingBookSelectionScreen.tsx)
- **Route / URL Params**: `OnboardingBookSelection` (`{ userId: string; username: string }`)
- **Access Roles**: Authenticated onboarding user
- **Key UI Elements**: Search input, OpenLibrary integration catalog list, custom book registration form.
- **Data Reads**: Reads catalog query from OpenLibrary search API, active reading metadata.
- **Data Writes**: Creates a `books` reference if not already present.
- **Navigations**:
  - **From**: `OnboardingUsername`
  - **To**: `OnboardingChapter`, `OnboardingJumpIn` (if skipped)

#### Onboarding Chapter Screen
- **File Path**: [OnboardingChapterScreen.tsx](file:///Users/devops/Desktop/Chaptr/src/screens/onboarding/OnboardingChapterScreen.tsx)
- **Route / URL Params**: `OnboardingChapter` (`{ book: Book }`)
- **Access Roles**: Authenticated onboarding user
- **Key UI Elements**: Scrollable vertical slider of chapters, starter checkbox indicator.
- **Data Reads**: Reads current book chapter structures.
- **Data Writes**: Creates an initial reading progression record via `createInitialReadingProgress`.
- **Navigations**:
  - **From**: `OnboardingBookSelection`
  - **To**: `OnboardingJumpIn`

#### Onboarding Genre Preferences Screen
- **File Path**: [OnboardingGenrePreferencesScreen.tsx](file:///Users/devops/Desktop/Chaptr/src/screens/onboarding/OnboardingGenrePreferencesScreen.tsx)
- **Route / URL Params**: `OnboardingGenrePreferences` (`{ userId: string }` or `{ userId; bookId; currentChapter }`)
- **Access Roles**: Authenticated onboarding user
- **Key UI Elements**: Grid of selectable genre pills, selection counter.
- **Data Reads**: None
- **Data Writes**: Updates the user profile `preferred_genres` list.
- **Navigations**:
  - **From**: `OnboardingChapter`
  - **To**: `OnboardingReadingGoal`

#### Onboarding Reading Goal Screen
- **File Path**: [OnboardingReadingGoalScreen.tsx](file:///Users/devops/Desktop/Chaptr/src/screens/onboarding/OnboardingReadingGoalScreen.tsx)
- **Route / URL Params**: `OnboardingReadingGoal` (`{ userId: string }`)
- **Access Roles**: Authenticated onboarding user
- **Key UI Elements**: Dropdowns to select target pages per week or pace selector.
- **Data Reads**: None
- **Data Writes**: Writes reading speed, goal paces, and goals to `users` profile.
- **Navigations**:
  - **From**: `OnboardingGenrePreferences`
  - **To**: `OnboardingJumpIn`

#### Onboarding Jump In Screen
- **File Path**: [OnboardingJumpInScreen.tsx](file:///Users/devops/Desktop/Chaptr/src/screens/onboarding/OnboardingJumpInScreen.tsx)
- **Route / URL Params**: `OnboardingJumpIn` (`{ userId: string }`)
- **Access Roles**: Authenticated onboarding user
- **Key UI Elements**: Success check animation, "Complete & Start Reading" primary CTA.
- **Data Reads**: Reads user profile status.
- **Data Writes**: Triggers the `completeOnboarding` api endpoint, storing `onboarding_completed_at` timestamp.
- **Navigations**:
  - **From**: Onboarding stack screens
  - **To**: `MainTabs` (resets navigator to user home)

---

### 1.3 Main App Tab Navigator
The main tab navigator controls the four foundational pages.

#### Home Screen
- **File Path**: [HomeScreen.tsx](file:///Users/devops/Desktop/Chaptr/src/screens/HomeScreen.tsx)
- **Route / URL Params**: `MainTabs` -> `Home` (`home` path prefix)
- **Access Roles**: Authenticated Reader
- **Key UI Elements**: Reading streak banner, active reading cards, progress bars, recent activity card, pinned threads lists, notification counts icon.
- **Data Reads**: Reads user active progress values, streak data, active club updates.
- **Data Writes**: None directly (navigates to writers)
- **Navigations**:
  - **From**: Tab selector, App Launch
  - **To**: `Notifications`, `Settings`, `ChapterCompletion`, `BookDetails`, `DiscussionDetails`, `Library`, `Profile`

#### Groups Screen
- **File Path**: [GroupsScreen.tsx](file:///Users/devops/Desktop/Chaptr/src/screens/GroupsScreen.tsx)
- **Route / URL Params**: `MainTabs` -> `Groups` (`groups` path prefix)
- **Access Roles**: Authenticated Reader
- **Key UI Elements**: Group cards list, search input, "Join Group with Code" drawer modal, "Create Group" setup form.
- **Data Reads**: Queries `groups` database lists, user memberships, public search catalog.
- **Data Writes**: Submits membership request if joining via code; creates a group if requested.
- **Navigations**:
  - **From**: Tab selector
  - **To**: `GroupDetail`, `GroupPreview`

#### Library Screen
- **File Path**: [LibraryScreen.tsx](file:///Users/devops/Desktop/Chaptr/src/screens/LibraryScreen.tsx)
- **Route / URL Params**: `MainTabs` -> `Library` (`library` path prefix)
- **Access Roles**: Authenticated Reader
- **Key UI Elements**: Shelf selector tabs (TBR, Reading, Finished, DNF), Book cards grid, search input, Custom shelves editor modal.
- **Data Reads**: Reads user shelf collection list, books inside shelves, total completion rates.
- **Data Writes**: Modifies shelf designations, deletes items.
- **Navigations**:
  - **From**: Tab selector
  - **To**: `BookDetails`, `Notes`, `AddBook`

#### Profile Screen
- **File Path**: [ProfileScreen.tsx](file:///Users/devops/Desktop/Chaptr/src/screens/ProfileScreen.tsx)
- **Route / URL Params**: `MainTabs` -> `Profile` (`profile` path prefix)
- **Access Roles**: Authenticated Reader
- **Key UI Elements**: User metrics grid (Streak, Chapters completed, active pace charts), badge achievements carousel, reading logs list.
- **Data Reads**: Profile data, user milestones, aggregate statistics.
- **Data Writes**: None
- **Navigations**:
  - **From**: Tab selector
  - **To**: `Settings`, `EditProfile`, `UserProfile` (for other users)

---

### 1.4 Detailed Stack Screens
These stack screens handle specific features.

#### Group Detail Screen
- **File Path**: [GroupDetailScreen.tsx](file:///Users/devops/Desktop/Chaptr/src/screens/GroupDetailScreen.tsx)
- **Route / URL Params**: `GroupDetail` (`{ group: ReadingGroup }`)
- **Access Roles**: Authenticated Reader (with restrictions for Creator/Admin)
- **Key UI Elements**: Banner header, current book card, live chapter completion list, channel directories, settings controls.
- **Data Reads**: Group details, members roster status, active milestones.
- **Data Writes**: None
- **Navigations**:
  - **From**: `GroupsScreen`, `HomeScreen`
  - **To**: `GroupChat`, `GroupSettings`, `GroupMembers`, `BookDetails`

#### Group Chat Screen
- **File Path**: [GroupChatScreen.tsx](file:///Users/devops/Desktop/Chaptr/src/screens/GroupChatScreen.tsx)
- **Route / URL Params**: `GroupChat` (`{ groupId: string; groupName: string; currentBook?: string }`)
- **Access Roles**: Group Member / Group Creator
- **Key UI Elements**: Sidebar channel menu, chat list, text field, emoji selector popup, spoiler hide toggle.
- **Data Reads**: Fetches messages from current channel, realtime web socket updates.
- **Data Writes**: Inserts rows into `channel_messages` and `message_reactions`.
- **Navigations**:
  - **From**: `GroupDetail`
  - **To**: `GroupSettings`, `GroupMembers`

#### Chapter Completion Screen
- **File Path**: [ChapterCompletionScreen.tsx](file:///Users/devops/Desktop/Chaptr/src/screens/ChapterCompletionScreen.tsx)
- **Route / URL Params**: `ChapterCompletion` (`{ chapterNumber; bookTitle; bookId; ... }`)
- **Access Roles**: Authenticated Reader
- **Key UI Elements**: Swipe-to-complete slider tracker, text field reflections, voice audio button, vocabulary checklist, celebration XP modals.
- **Data Reads**: Book metadata, existing chapter state.
- **Data Writes**: Writes a completion log in `chapter_completions`, increments user streak counters, posts a summary update.
- **Navigations**:
  - **From**: `HomeScreen`, `BookDetails`
  - **To**: `HomeScreen` (on close)

#### Note Editor Screen
- **File Path**: [NoteEditorScreen.tsx](file:///Users/devops/Desktop/Chaptr/src/screens/NoteEditorScreen.tsx)
- **Route / URL Params**: `NoteEditor` (`{ bookId; bookTitle; editingNote? }`)
- **Access Roles**: Authenticated Reader
- **Key UI Elements**: Fullscreen editor text-area (supporting markdown), chapter tag drop-down list, public/private toggle buttons.
- **Data Reads**: Fetches single personal note fields if editing.
- **Data Writes**: CRUD writes to `personal_notes` table.
- **Navigations**:
  - **From**: `NotesScreen`
  - **To**: `NotesScreen` (pops back)

#### Admin Dashboard Screen
- **File Path**: [AdminDashboardScreen.tsx](file:///Users/devops/Desktop/Chaptr/src/screens/AdminDashboardScreen.tsx)
- **Route / URL Params**: `AdminDashboard`
- **Access Roles**: Site Administrator (`is_admin === true`)
- **Key UI Elements**: Statistics dashboard, reported comments flags queue, user status override lists.
- **Data Reads**: Reports list, database users status.
- **Data Writes**: Moderation overrides, user suspensions, deletes reported posts.
- **Navigations**:
  - **From**: `Settings`
  - **To**: `UserProfile`

---

## 2. Data Models

Data shapes are declared in TypeScript files at [database.types.ts](file:///Users/devops/Desktop/Chaptr/src/types/database.types.ts) and [channels.types.ts](file:///Users/devops/Desktop/Chaptr/src/types/channels.types.ts).

### Users Table (`users`)
Represents profile definitions and aggregates.
- `id` (string / UUID) — **Primary Key** -> references `auth.users.id`.
- `username` (string) — Unique identifier name.
- `display_name` (string | null) — Display alias.
- `bio` (string | null) — Profile bio description.
- `avatar_url` (string | null) — URL linking to storage.
- `favorite_genre` (string | null) — Top selected genre.
- `preferred_genres` (string[] | null) — Multiple array.
- `reading_streak` (number) — Current consecutive days count.
- `current_streak_start` (string | null) — Streak beginning timestamp.
- `average_reading_speed` (number | null) — Pages read per hour.
- `yearly_reading_goal` (number | null) — Target book count.
- `total_books_completed` (number | null) — Aggregate count.
- `total_pages_read` (number | null) — Aggregate pages.
- `onboarding_completed_at` (string | null) — Onboarding timestamp tracker.
- `is_admin` (boolean | null) — Platform admin capability.
- `status` (`'active' | 'inactive' | 'suspended'`) — User status state.

### Books Table (`books`)
Catalog metadata for tracked books.
- `id` (string / UUID) — **Primary Key**.
- `title` (string) — Book title.
- `author` (string) — Author name.
- `total_pages` (number) — Page count.
- `total_chapters` (number) — Total chapters.
- `cover_image_url` (string | null) — Catalog image.

### Reading Progress Table (`reading_progress`)
The active progress mapping of a reader for a specific book.
- `id` (string / UUID) — **Primary Key**.
- `user_id` (string) — **Foreign Key** -> references `users.id`.
- `book_id` (string) — **Foreign Key** -> references `books.id`.
- `group_id` (string | null) — **Foreign Key** -> references `reading_groups.id` (null if solo reading).
- `current_chapter` (number) — The reader's last completed chapter.
- `progress_percentage` (number) — Decimal progress scale.
- `status` (`'reading' | 'completed' | 'paused' | 'abandoned'`) — Active status.

### Chapter Completions Table (`chapter_completions`)
Individual logs tracking each completed chapter.
- `id` (string / UUID) — **Primary Key**.
- `user_id` (string) — **Foreign Key** -> references `users.id`.
- `book_id` (string) — **Foreign Key** -> references `books.id`.
- `group_id` (string | null) — **Foreign Key** -> references `reading_groups.id`.
- `chapter_number` (number) — Logged chapter integer.
- `reflection_text` (string | null) — Personal commentary/reflection.
- `completed_at` (string) — Timestamp.

### Personal Notes Table (`personal_notes`)
A user's private and public markdown notes for a book.
- `id` (string / UUID) — **Primary Key**.
- `user_id` (string) — **Foreign Key** -> references `users.id`.
- `book_id` (string) — **Foreign Key** -> references `books.id`.
- `chapter_number` (number) — Associated chapter.
- `note_content` (string) — Markdown text body.
- `is_private` (boolean) — Visibility toggle.

### Reading Groups Table (`reading_groups`)
Metadata for book clubs.
- `id` (string / UUID) — **Primary Key**.
- `name` (string) — Group name.
- `created_by` (string) — **Foreign Key** -> references `users.id` (Creator/Owner).
- `current_book_id` (string | null) — **Foreign Key** -> references `books.id`.
- `reading_pace` (`'relaxed' | 'moderate' | 'intense'`) — Group speed.
- `is_public` (boolean) — Discovery visibility toggle.
- `invite_code` (string) — Generated code.

### Group Channels Table (`group_channels`)
Discord-style channel paths within a reading group.
- `id` (string / UUID) — **Primary Key**.
- `group_id` (string) — **Foreign Key** -> references `reading_groups.id`.
- `name` (string) — Channel string.
- `channel_type` (`'currently_reading' | 'general' | 'custom'`) — Type constraints.
- `is_chapter_gated` (boolean) — Restricts messages unless matching user `current_chapter`.

### Channel Messages Table (`channel_messages`)
Chat logs within channels.
- `id` (string / UUID) — **Primary key**.
- `channel_id` (string) — **Foreign Key** -> references `group_channels.id`.
- `user_id` (string) — **Foreign Key** -> references `users.id`.
- `content` (string) — Text payload.
- `chapter_number` (number | null) — Message source chapter reference.
- `is_spoiler_gated` (boolean) — Spoiler click-to-view filter.

---

## 3. API Surface

The API surface is structured as direct Supabase Client library wrappers located under [src/lib/api/](file:///Users/devops/Desktop/Chaptr/src/lib/api).

### 3.1 Authentication (`auth.ts`)
- **`signInWithPassword(email/phone, password)`**: Resolves credentials session.
- **`signUp(email, password, displayName)`**: Inserts new auth user.
- **`checkUsernameAvailability(desired_username)`**: RPC checking.

### 3.2 Books catalog (`books.ts`)
- **`searchBooks(query)`**: Calls OpenLibrary API.
- **`createBook(bookData)`**: Commits selected book details to database cache.
- **`getBookDetails(bookId)`**: Retrieves book metadata.

### 3.3 Reading Groups (`groups.ts`)
- **`createGroup(name, currentBookId, readingPace, isPublic)`**: Inserts new group and registers the creator.
- **`joinGroupWithCode(inviteCode)`**: Verifies and updates membership lists.
- **`getGroupChannels(groupId)`**: Fetches channel lists.
- **`getGroupDetails(groupId)`**: Returns group profile and member progress stats.

### 3.4 Library & Notes (`library.ts`)
- **`fetchUserLibrary(userId)`**: Selects book rows mapping user shelves.
- **`updateReadingProgress(progressId, currentChapter)`**: Rewrites progress level.
- **`createPersonalNote(bookId, chapter, content, isPrivate)`**: Inserts new note.

### 3.5 Discussions (`discussions.ts`)
- **`fetchDiscussions(bookId, groupId)`**: Returns discussion threads.
- **`createDiscussion(title, content, bookId, groupId)`**: Inserts discussion.

### 3.6 Realtime (`realtime.ts`)
- **`subscribeToChannelMessages(channelId, callback)`**: Opens Supabase Realtime channel stream for real-time chat updates.

> [!IMPORTANT]
> **Payments Disclaimer**: The codebase contains **zero** references to Stripe, payment portals, or paywalls. All features are open and direct Postgres tables, meaning no billing system migrations are required.

---

## 4. Design Tokens

The styling system is located at [src/theme/](file:///Users/devops/Desktop/Chaptr/src/theme). It is built as a custom TypeScript layout configuration using vanilla React Native `StyleSheet` styling, rather than external component libraries (like NativeWind or Tamagui).

### 4.1 Color Palettes

| Token | Light Mode Hex | Dark Mode Hex |
| :--- | :--- | :--- |
| `background` | `#F8F5EF` (Warm Warm Sand) | `#0C1014` (Deep Coal) |
| `surface` | `#FFFFFF` | `#141820` |
| `surfaceElevated` | `#FFFFFF` | `#1C2028` |
| `text.primary` | `#1F1F1F` | `#F2F2F2` |
| `text.secondary` | `#4D4D4D` | `#B3B3B3` |
| `text.tertiary` | `#757575` | `#808080` |
| `interactive.primary` | `#1D4E4B` (Deep Forest) | `#4A9E9A` (Teal Accent) |
| `border.main` | `#E5E1D9` | `#282E38` |
| `success.main` | `#2E7D4A` | `#5AAA75` |
| `error.main` | `#C42847` | `#D94A66` |

### 4.2 Typography & Fonts
- **Font Families**:
  - Headings/Book Titles: `Crimson Pro` (`CrimsonPro_300Light` to `CrimsonPro_700Bold`)
  - Body & UI Controls: `Inter` (`Inter_100Thin` to `Inter_900Black`)
- **Hierarchy Values**:
  - `heroTitle`: Serif, size 40px, letter-spacing -1.
  - `sectionTitle`: Serif, size 34px, letter-spacing -0.7.
  - `cardTitle`: Serif, size 22px, letter-spacing -0.3.
  - `bodyText`: Sans, size 17px, line-height 26.
  - `button`: Sans, size 18px, letter-spacing 0.5 (bold).

### 4.3 Spacing & Radius Scales
- **Spacing**: `xs: 4`, `sm: 8`, `md: 12`, `lg: 16`, `xl: 20`, `2xl: 24`, `3xl: 32`, `4xl: 40`, `5xl: 48`.
- **Border Radius**: `none: 0`, `sm: 6`, `base: 8`, `md: 10`, `lg: 12`, `xl: 16`, `2xl: 20`, `full: 999`.

---

## 5. Key User Flows

The core interactive loops map to the following screen routes:

### 5.1 Account Setup & Onboarding
1. Unauthenticated user starts at `Welcome` and presses "Get Started" to go to `SignUp`.
2. Registers account. On authentication success, navigator redirects to `OnboardingUsername`.
3. Chooses username, updates preferred genres in `OnboardingGenrePreferences`.
4. Searches catalog in `OnboardingBookSelection` and picks a book.
5. In `OnboardingChapter`, chooses starting chapter.
6. Progresses to `OnboardingJumpIn`, which calls `completeOnboarding` and loads `HomeScreen` inside `MainTabs`.

### 5.2 Creating/Joining a Book Club
1. User clicks the `Groups` tab.
2. **To Join**: Clicks "Join with Code", inputs invite code. Instantly updates database memberships and redirects to `GroupDetail`.
3. **To Create**: Clicks "Create Group", inputs Name, searches for book, picks reading pace (relaxed, moderate, intense), and saves. Creator membership is added and the user is redirected to `GroupDetail` as Creator.

### 5.3 Logging Chapter Completions
1. On `HomeScreen`, user clicks "Current Read" book or enters `ChapterCompletion` screen.
2. Adjusts chapter slider selector.
3. (Optional) Toggles Voice reflection and records audio review, or enters text.
4. Selects any completed vocabulary words.
5. Clicks "Mark Chapter Complete" button. App registers record in `chapter_completions`, awards user XP points (triggering the celebration modal), and redirects back to `HomeScreen`.

### 5.4 Discord-Style Club Chatting
1. Inside `GroupDetail`, user selects a channel from the directory list (e.g. "Currently Reading" which is chapter-gated, or "General").
2. User goes to `GroupChat` screen.
3. User reads message list (real-time stream).
4. User types message. If writing about a future chapter, triggers "Spoiler Gate" toggle.
5. Sends message. Broadcasts instantly via `supabase.realtime` channels.

---

## 6. Anything Web-Specific to Flag

When building the React / Next.js web application equivalent, several mobile-native packages and paradigms will require web-compatible alternatives.

### 6.1 Native Permissions & Features

- **Voice Transcription / Speech-to-Text**:
  - *Mobile*: Uses a native module wrapped in [speechRecognition.ts](file:///Users/devops/Desktop/Chaptr/src/lib/speechRecognition.ts).
  - *Web parity*: Replace with the standard browser [Web Speech API (SpeechRecognition)](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition) or a cloud speech-to-text integration.

- **Audio/Camera Uploads & File Picking**:
  - *Mobile*: Relies on native document pickers.
  - *Web parity*: Replace with standard HTML `<input type="file" accept="audio/*,image/*" />` fields.

- **Offline Support & State Caching**:
  - *Mobile*: Relies on AsyncStorage and `@react-query-persist-client`.
  - *Web parity*: Replace AsyncStorage with IndexedDB or LocalStorage wrappers to ensure large capacity storage of offline drafts.

- **Network Monitoring**:
  - *Mobile*: Uses `@react-native-community/netinfo` inside [App.tsx](file:///Users/devops/Desktop/Chaptr/App.tsx).
  - *Web parity*: Replace with browser `navigator.onLine` window event listeners.

- **Deep Linking**:
  - *Mobile*: Configured via native URI schemas (`chaptr://`).
  - *Web parity*: Replaced by standard URL routing paths matching the URL patterns (e.g. `https://chaptrnote.com/join/:groupId`).
