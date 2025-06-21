# Mini Lesson Web App Style Guide

This document provides a detailed description of the visual style and components of the Mini Lesson Web App. It is intended to be used by an LLM to recreate the application's front-end design with high fidelity.

## 1. Core Technologies & Libraries

The design is built upon a foundation of several key technologies:

- **Tailwind CSS:** The primary framework for utility-first styling. A custom `primary` color (`#3b82f6`) is defined.
- **`md-block.js`:** A web component used to render Markdown content within the lesson area.
- **`highlight.js`:** Used for syntax highlighting within code blocks. The "github.min.css" theme is applied.
- **`highlighter-decorator`:** A custom web component for text highlighting within the lesson content.
- **MathJax:** For rendering mathematical notation.

## 2. Overall Layout

The application uses a two-column layout that fills the entire viewport (`100vh`).

- **App Container (`.app-container`):**
  - A flex container that arranges the two main columns.
  - `display: flex;`
  - `height: 100vh;`
  - `width: 100vw;`

- **Left Column: Main Content (`.main-content`):**
  - Takes up the remaining space (`flex: 1;`).
  - Contains padding for spacing (`padding: 2rem;`).
  - Is a flex column itself to contain the lesson container.
  - Background color: `#f8f9fa`.

- **Right Column: Chat Sidebar (`.chat-sidebar`):**
  - Fixed width: `30%` of the viewport width.
  - Contains a left border for separation (`border-left: 1px solid #ccc;`).
  - Has its own padding (`padding: 20px;`).
  - Background color: `#f9f9f9`.
  - Is a flex column to arrange the chat components vertically.

## 3. Color Palette

- **Primary Blue:** `#3b82f6` (Used for the highlighter pin color).
- **Primary Green (Buttons):** `#4CAF50` (Chat send button). Hover: `#45a049`.
- **Gray (Buttons):** `#6c757d` (Reset lesson button).
- **Backgrounds:**
  - Main App BG: `#f8f9fa`
  - Chat Sidebar BG: `#f9f9f9`
  - Lesson Container BG: `white`
  - Markdown Area BG: `#f9f9f9`
  - Code blocks BG: `#f6f8fa`
- **Text:**
  - Headings: `#2c3e50`
  - Body Text / Paragraphs: `#34495e`
  - Welcome Message Italic Text: `#34495e`
  - Blockquote Text: `#666`
- **Chat Messages:**
  - User Message BG: `#e1f5fe` (Light blue)
  - Assistant/System Message BG: `#eee` (Gray)
  - Agent Message BG: `#f0f4ff` with a `#4CAF50` (green) left border.
- **Borders:**
  - General Divider: `#ccc` or `#eee`
  - Lesson Header Divider: `#dee2e6`
  - Blockquote Divider: `#ddd`

## 4. Typography

- **Font Family:** A sans-serif system stack is used for the main body text: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif`.
- **Code Font Family:** A monospace stack is used for code: `'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace`.
- **Base Line Height:** `1.6`.
- **Headings (`h1`, `h2`, etc.):** Margin top `1.5em`, margin bottom `0.5em`.
- **Paragraphs (`p`):** Margin bottom `1em`.

## 5. Component Styling

### 5.1. Lesson Container (`.lesson-container`)

- A white box with rounded corners and a subtle shadow.
- `background: white;`
- `border-radius: 8px;`
- `box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);`
- `padding: 2rem;`
- Has vertical scrolling (`overflow-y: auto;`).

### 5.2. Chat Sidebar (`.chat-sidebar`)

- **Chat Header:** White background with a bottom border.
- **Message Container (`#messageContainer`):**
  - Grows to fill available space (`flex-grow: 1;`).
  - White background with a light border.
  - Has vertical scrolling.
- **Chat Messages (`.chat-message`):**
  - Have `padding` and `border-radius`.
  - User messages are aligned to the right.
  - Assistant/System/Agent messages are aligned to the left.
- **Chat Input (`.chat-input`):**
  - A flex container holding the text input and send button.
  - **Input Field:** Takes up most of the space. Has a light border and white background. No outline on focus.
  - **Send Button:** Green background (`#4CAF50`), white text. No left border to merge with the input field.

### 5.3. Markdown & Lesson Content

- **Markdown Area (`.markdown-content`):**
  - Centered within the lesson container with side margins (`margin-left: 15%; margin-right: 15%;`).
  - Light gray background (`#f9f9f9`).
- **Code Blocks (`pre`):** Light gray background, padding, and rounded corners.
- **Inline Code (`code`):** Slightly different light gray background and small padding.
- **Blockquotes:** Gray text with a solid gray left border.

### 5.4. Buttons

- **Reset Button (`.reset-button`):** Gray background, white text, rounded corners.
- **Pagination Buttons (`#prevButton`, `#nextButton`):**
  - Standard button styles.
  - `disabled` state has a gray background and `not-allowed` cursor.
  - Hover state (when not disabled) has a slightly darker background.
- **Send Button (`#sendButton`):** See Chat Input section.

### 5.5. Custom Components

- **Highlighter Decorator (`highlighter-decorator`):**
  - This is a custom element. The styling for the component itself is likely within its own Shadow DOM, but it's configured with:
    - `pinColor: '#3b82f6'` (primary blue)
    - `highlightColor: 'rgba(59, 130, 246, 0.2)'` (transparent primary blue)
    - `pinPosition: 'bottom-right'`

## 6. Animations & Indicators

- **Loading Indicator (`.loading-indicator`):**
  - A simple bounce animation (`@keyframes bounce`) applied to three `<span>` elements.
  - The spans are styled as dots.
- **Agent Banner (`#agentBanner`):**
  - Hidden by default.
  - When visible, it likely shows information about the current agent/process.

This guide should provide a comprehensive blueprint for replicating the visual design of the application. 