export default {
  // Header
  examples: 'Ejemplos',
  share: 'Compartir',
  copied: '¡Copiado!',
  copy_dsl: 'Copiar DSL',
  sign_in: 'Entrar',
  sign_out: 'Salir',
  copy_shareable_link: 'Copiar enlace',

  // Session bar
  new_session_btn: 'Nuevo',
  default_session_title: 'Nueva sesión',
  untitled: 'Sin título',
  rename_diagram: 'Renombrar diagrama',
  delete_session: 'Eliminar sesión',
  loading_diagrams: 'Cargando tus diagramas…',
  anon_import_banner: (n) => n === 1 ? 'Tienes 1 diagrama anónimo sin guardar.' : `Tienes ${n} diagramas anónimos sin guardar.`,
  anon_import_btn: 'Importar',
  anon_import_dismiss: 'Descartar',

  // Tabs
  tab_editor: 'Editor DSL',
  tab_chat: 'Chat IA',

  // Editor
  editor_placeholder: 'Escribe tu DSL de Skemly aquí…',
  nodes: 'nodos',
  edges: 'aristas',
  groups: 'grupos',
  reference: 'Referencia',
  clear: 'Limpiar',

  // Mobile tabs
  mobile_diagram: 'Diagrama',
  mobile_chat: 'Chat',
  mobile_code: 'Código',

  // Email verification banner
  verify_email_banner: 'Verifica tu email para asegurar tu cuenta.',
  verify_now: 'Verificar ahora',

  // Diagnostics
  layout_error_prefix: 'Error de layout',
  line_prefix: 'Línea',

  // Relative time
  just_now: 'ahora',
  minutes_ago: (n) => `hace ${n}m`,
  hours_ago: (n) => `hace ${n}h`,
  days_ago: (n) => `hace ${n}d`,

  // Chat panel
  chat_empty_title: 'Describe el diagrama que quieres crear.',
  chat_empty_hint: 'p.ej. "Crea un diagrama de arquitectura con un load balancer y dos servidores"',
  chat_thinking: 'Pensando…',
  chat_retry: 'Reintentar',
  chat_reapply: 'Re-aplicar',
  chat_placeholder: 'Describe un diagrama… (Enter para enviar, Shift+Enter para nueva línea)',
  chat_attach_tooltip: 'Adjuntar fichero — imágenes (PNG/JPG/WEBP), PDF (máx. 100 pág.), texto',
  chat_mic_stop: 'Detener dictado',
  chat_mic_start: 'Dictar por voz',
  chat_requests_remaining: (n) => `${n} solicitudes restantes hoy`,
  chat_file_too_large: (mb) => `El fichero es demasiado grande (máx. ${mb} MB).`,
  chat_file_read_error: 'No se pudo leer el fichero.',
  chat_network_error: 'Error de red — comprueba tu conexión',
  chat_unknown_error: 'Error desconocido',

  // DSL Reference Panel
  dsl_ref_title: 'Referencia DSL',
  dsl_ref_close_hint: 'Pulsa Esc para cerrar',
  dsl_sections: [
    {
      title: 'Formas',
      rows: [
        { syntax: '[Texto]',           desc: 'Caja (proceso, entidad)' },
        { syntax: '(Texto)',           desc: 'Cilindro (base de datos)' },
        { syntax: '?Texto?',           desc: 'Diamante (decisión)' },
        { syntax: '<Texto>',           desc: 'Nube (externo, SaaS)' },
        { syntax: '{Header | Cuerpo}', desc: 'Tarjeta (título + descripción)' },
      ],
    },
    {
      title: 'Relaciones',
      rows: [
        { syntax: 'A -> B',             desc: 'Flecha dirigida' },
        { syntax: 'A <-> B',            desc: 'Bidireccional' },
        { syntax: 'A -> "Label" -> B',  desc: 'Con etiqueta' },
        { syntax: '[A],[B] -> [C],[D]', desc: 'Expansión cartesiana' },
      ],
    },
    {
      title: 'IDs estables',
      rows: [
        { syntax: '[id|Label]',      desc: 'ID explícito + etiqueta' },
        { syntax: '[app1|Servidor]', desc: 'Ejemplo: id "app1"' },
      ],
    },
    {
      title: 'Tags',
      rows: [
        { syntax: '[Nodo]#danger',  desc: 'Rojo — peligro / error' },
        { syntax: '[Nodo]#warning', desc: 'Naranja — advertencia' },
        { syntax: '[Nodo]#info',    desc: 'Azul — informativo' },
        { syntax: '[Nodo]#safe',    desc: 'Verde — OK / seguro' },
      ],
    },
    {
      title: 'Grupos',
      rows: [
        { syntax: 'group "Título" {',       desc: 'Grupo sin tag' },
        { syntax: 'group "Título" #info {', desc: 'Grupo con tag' },
        { syntax: '  [Nodo]',               desc: 'Nodo dentro del grupo' },
        { syntax: '}',                      desc: 'Cierre del grupo' },
      ],
    },
    {
      title: 'Directivas',
      rows: [
        { syntax: 'vibe: clean',     desc: 'Tema: clean · handdrawn · cyberpunk' },
        { syntax: 'layout: TD',      desc: 'Dirección: TD (top-down) · LR · MM' },
        { syntax: 'spacing: 40',     desc: 'Separación entre nodos' },
        { syntax: 'edgeLabels: off', desc: 'Ocultar etiquetas de aristas' },
      ],
    },
    {
      title: 'Iconos',
      rows: [
        { syntax: '[User]',          desc: 'Auto: user, users, person, people' },
        { syntax: '[Database]',      desc: 'Auto: db, database' },
        { syntax: '[API]',           desc: 'Auto: api, server, cache, queue…' },
        { syntax: '[N]@icon=Shield', desc: 'Explícito: cualquier icono Lucide' },
      ],
    },
    {
      title: 'Colores',
      rows: [
        { syntax: '[N]@bg=#1e293b',          desc: 'Color de fondo (hex o CSS)' },
        { syntax: '[N]@color=white',         desc: 'Color del texto' },
        { syntax: '[N]@bg=#111@color=#0ff',  desc: 'Ambos combinados' },
        { syntax: '[N]@icon=X@bg=steelblue', desc: 'Con icono' },
      ],
    },
    {
      title: 'Enlace URL',
      rows: [
        { syntax: '[N]@url=https://...',            desc: 'Click abre URL en nueva pestaña' },
        { syntax: '[id|Label]@url=https://...',     desc: 'Con ID explícito' },
        { syntax: '[N]@url=https://...@bg=#dbeafe', desc: 'Combinado con color' },
      ],
    },
    {
      title: 'Formato de texto',
      rows: [
        { syntax: '[**Negrita**]',    desc: 'Texto en negrita' },
        { syntax: '[__Subrayado__]',  desc: 'Texto subrayado' },
        { syntax: '[**__Ambos__**]',  desc: 'Negrita y subrayado' },
      ],
    },
  ],

  // Auth modal
  auth_login_tab: 'Iniciar sesión',
  auth_register_tab: 'Crear cuenta',
  auth_verify_title: 'Verifica tu email',
  auth_name_label: 'Nombre',
  auth_name_optional: '(opcional)',
  auth_name_placeholder: 'Tu nombre',
  auth_email_label: 'Email',
  auth_password_label: 'Contraseña',
  auth_password_min: 'Mínimo 8 caracteres',
  auth_password_mask: '••••••••',
  auth_submit_login: 'Entrar',
  auth_submit_register: 'Crear cuenta',
  auth_loading_login: 'Entrando…',
  auth_loading_register: 'Creando cuenta…',
  auth_no_account: '¿No tienes cuenta?',
  auth_register_link: 'Regístrate',
  auth_has_account: '¿Ya tienes cuenta?',
  auth_login_link: 'Inicia sesión',
  auth_error_unknown: 'Error desconocido',
  auth_error_connection: 'Error de conexión. Inténtalo de nuevo.',
  auth_verify_sent: 'Te enviamos un código de 6 dígitos a',
  auth_verify_check_inbox: 'Revisa tu bandeja de entrada.',
  auth_verify_code_label: 'Código de verificación',
  auth_verify_btn: 'Verificar',
  auth_verifying: 'Verificando…',
  auth_change_email: 'Cambiar email',
  auth_resend: 'Reenviar código',
  auth_resend_cooldown: (s) => `Reenviar (${s}s)`,
  auth_resend_error: 'Error al reenviar',

  // Examples panel
  examples_title: 'Ejemplos',
  examples_count: (n) => `${n} diagramas listos para usar`,
  examples_copy_link: 'Copiar enlace',
  examples_link_copied: '¡Copiado!',
  examples_footer: 'Haz clic en cualquier ejemplo para cargarlo en el editor',

  // Shared diagram page
  shared_loading: 'Cargando diagrama…',
  shared_not_found: 'Diagrama no encontrado',
  shared_edit: 'Editar este diagrama',
  shared_create: 'Crear el tuyo',
}
