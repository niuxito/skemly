export default {
  // Header
  examples: 'Examples',
  share: 'Share',
  copied: 'Copied!',
  copy_dsl: 'Copy DSL',
  sign_in: 'Sign in',
  sign_out: 'Sign out',
  copy_shareable_link: 'Copy shareable link',

  // Session bar
  new_session_btn: 'New',
  default_session_title: 'New session',
  untitled: 'Untitled',
  rename_diagram: 'Rename diagram',
  delete_session: 'Delete session',
  loading_diagrams: 'Loading your diagrams…',
  anon_import_banner: (n) => n === 1 ? 'You have 1 unsaved diagram from before signing in.' : `You have ${n} unsaved diagrams from before signing in.`,
  anon_import_btn: 'Import',
  anon_import_dismiss: 'Dismiss',

  // Tabs
  tab_editor: 'DSL Editor',
  tab_chat: 'AI Chat',

  // Editor
  editor_placeholder: 'Type your Skemly DSL here…',
  nodes: 'nodes',
  edges: 'edges',
  groups: 'groups',
  reference: 'Reference',
  clear: 'Clear',

  // Mobile tabs
  mobile_diagram: 'Diagram',
  mobile_chat: 'Chat',
  mobile_code: 'Code',

  // Email verification banner
  verify_email_banner: 'Verify your email to secure your account.',
  verify_now: 'Verify now',

  // Diagnostics
  layout_error_prefix: 'Layout error',
  line_prefix: 'Line',

  // Relative time
  just_now: 'just now',
  minutes_ago: (n) => `${n}m ago`,
  hours_ago: (n) => `${n}h ago`,
  days_ago: (n) => `${n}d ago`,

  // Chat panel
  canvas_empty_hint: 'Describe your diagram in the chat →',
  chat_empty_title: 'Describe the diagram you want to create.',
  chat_empty_hint: 'e.g. "Create an architecture diagram with a load balancer and two app servers"',
  chat_thinking: 'Thinking…',
  chat_refining: 'Refining request…',
  chat_retry: 'Retry',
  chat_reapply: 'Re-apply',
  chat_placeholder: 'Describe a diagram… (Enter to send, Shift+Enter for newline)',
  chat_attach_tooltip: 'Attach file — images (PNG/JPG/WEBP), PDF (max. 100 pages), text',
  chat_mic_stop: 'Stop dictation',
  chat_mic_start: 'Dictate by voice',
  chat_enhanced_label: 'Refined request',
  chat_enhance_on_tooltip: 'Auto-refine enabled — the assistant will expand your prompt before generating the diagram',
  chat_enhance_off_tooltip: 'Auto-refine disabled — click to enable',
  chat_requests_remaining: (n) => `${n} requests remaining today`,
  chat_file_too_large: (mb) => `File is too large (max. ${mb} MB).`,
  chat_file_read_error: 'Could not read the file.',
  chat_network_error: 'Network error — check your connection',
  chat_unknown_error: 'Unknown error',

  // DSL Reference Panel
  dsl_ref_title: 'DSL Reference',
  dsl_ref_close_hint: 'Press Esc to close',
  dsl_sections: [
    {
      title: 'Shapes',
      rows: [
        { syntax: '[Text]',            desc: 'Box (process, entity)' },
        { syntax: '(Text)',            desc: 'Cylinder (database)' },
        { syntax: '?Text?',            desc: 'Diamond (decision)' },
        { syntax: '<Text>',            desc: 'Cloud (external, SaaS)' },
        { syntax: '{Header | Body}',   desc: 'Card (title + description)' },
      ],
    },
    {
      title: 'Relationships',
      rows: [
        { syntax: 'A -> B',             desc: 'Directed arrow' },
        { syntax: 'A <-> B',            desc: 'Bidirectional' },
        { syntax: 'A -> "Label" -> B',  desc: 'With label' },
        { syntax: '[A],[B] -> [C],[D]', desc: 'Cartesian expansion' },
      ],
    },
    {
      title: 'Stable IDs',
      rows: [
        { syntax: '[id|Label]',      desc: 'Explicit ID + label' },
        { syntax: '[app1|Server]',   desc: 'Example: id "app1"' },
      ],
    },
    {
      title: 'Tags',
      rows: [
        { syntax: '[Node]#danger',  desc: 'Red — danger / error' },
        { syntax: '[Node]#warning', desc: 'Orange — warning' },
        { syntax: '[Node]#info',    desc: 'Blue — informational' },
        { syntax: '[Node]#safe',    desc: 'Green — OK / safe' },
      ],
    },
    {
      title: 'Groups',
      rows: [
        { syntax: 'group "Title" {',      desc: 'Group without tag' },
        { syntax: 'group "Title" #info {', desc: 'Group with tag' },
        { syntax: '  [Node]',             desc: 'Node inside group' },
        { syntax: '}',                    desc: 'Close group' },
      ],
    },
    {
      title: 'Directives',
      rows: [
        { syntax: 'vibe: clean',     desc: 'Theme: clean · handdrawn · cyberpunk' },
        { syntax: 'layout: TD',      desc: 'Direction: TD (top-down) · LR · MM' },
        { syntax: 'spacing: 40',     desc: 'Node spacing' },
        { syntax: 'edgeLabels: off', desc: 'Hide edge labels' },
      ],
    },
    {
      title: 'Icons',
      rows: [
        { syntax: '[User]',          desc: 'Auto: user, users, person, people' },
        { syntax: '[Database]',      desc: 'Auto: db, database' },
        { syntax: '[API]',           desc: 'Auto: api, server, cache, queue…' },
        { syntax: '[N]@icon=Shield', desc: 'Explicit: any Lucide icon' },
      ],
    },
    {
      title: 'Colors',
      rows: [
        { syntax: '[N]@bg=#1e293b',          desc: 'Background color (hex or CSS)' },
        { syntax: '[N]@color=white',         desc: 'Text color' },
        { syntax: '[N]@bg=#111@color=#0ff',  desc: 'Both combined' },
        { syntax: '[N]@icon=X@bg=steelblue', desc: 'With icon' },
      ],
    },
    {
      title: 'URL Link',
      rows: [
        { syntax: '[N]@url=https://...',            desc: 'Click opens URL in new tab' },
        { syntax: '[id|Label]@url=https://...',     desc: 'With explicit ID' },
        { syntax: '[N]@url=https://...@bg=#dbeafe', desc: 'Combined with color' },
      ],
    },
    {
      title: 'Text Formatting',
      rows: [
        { syntax: '[**Bold**]',      desc: 'Bold text' },
        { syntax: '[__Underline__]', desc: 'Underlined text' },
        { syntax: '[**__Both__**]',  desc: 'Bold and underlined' },
      ],
    },
  ],

  // Auth modal
  auth_login_tab: 'Sign in',
  auth_register_tab: 'Create account',
  auth_verify_title: 'Verify your email',
  auth_name_label: 'Name',
  auth_name_optional: '(optional)',
  auth_name_placeholder: 'Your name',
  auth_email_label: 'Email',
  auth_password_label: 'Password',
  auth_password_min: 'At least 8 characters',
  auth_password_mask: '••••••••',
  auth_submit_login: 'Sign in',
  auth_submit_register: 'Create account',
  auth_loading_login: 'Signing in…',
  auth_loading_register: 'Creating account…',
  auth_no_account: "Don't have an account?",
  auth_register_link: 'Sign up',
  auth_has_account: 'Already have an account?',
  auth_login_link: 'Sign in',
  auth_error_unknown: 'Unknown error',
  auth_error_connection: 'Connection error. Please try again.',
  auth_verify_sent: 'We sent a 6-digit code to',
  auth_verify_check_inbox: 'Check your inbox.',
  auth_verify_code_label: 'Verification code',
  auth_verify_btn: 'Verify',
  auth_verifying: 'Verifying…',
  auth_change_email: 'Change email',
  auth_resend: 'Resend code',
  auth_resend_cooldown: (s) => `Resend (${s}s)`,
  auth_resend_error: 'Failed to resend',

  // Examples panel
  examples_title: 'Examples',
  examples_count: (n) => `${n} diagrams ready to use`,
  examples_copy_link: 'Copy link',
  examples_link_copied: 'Copied!',
  examples_footer: 'Click any example to load it in the editor',

  // Shared diagram page
  shared_loading: 'Loading diagram…',
  shared_not_found: 'Diagram not found',
  shared_edit: 'Edit this diagram',
  shared_create: 'Create your own',
}
