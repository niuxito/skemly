import { ArrowLeft } from 'lucide-react'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-slate-200">
        <div className="flex items-center gap-3">
          <a href="/" className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors">
            <ArrowLeft size={13} />
            Volver al editor
          </a>
          <span className="text-slate-200">|</span>
          <span className="font-bold text-slate-800">Skemly</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Política de Privacidad</h1>
          <p className="text-sm text-slate-500">Última actualización: 13 de marzo de 2026</p>
        </div>

        <div className="prose prose-slate max-w-none space-y-8 text-slate-700 leading-relaxed">

          {/* Intro */}
          <section>
            <p>
              En Skemly nos comprometemos a proteger tu privacidad y a tratar tus datos personales
              de forma transparente y conforme al <strong>Reglamento (UE) 2016/679 del Parlamento
              Europeo y del Consejo (RGPD)</strong> y a la normativa española de protección de datos.
            </p>
            <p className="mt-3">
              Esta Política de Privacidad describe qué datos recogemos, para qué los utilizamos,
              con quién los compartimos y cuáles son tus derechos como usuario.
            </p>
          </section>

          {/* 1 */}
          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-3">1. Responsable del tratamiento</h2>
            <div className="bg-slate-100 rounded-lg p-4 text-sm space-y-1">
              <p><strong>Denominación:</strong> Skemly</p>
              <p><strong>Sitio web:</strong> <a href="https://skemly.app" className="underline text-slate-800 hover:text-slate-600">skemly.app</a></p>
              <p><strong>Email de contacto:</strong> <a href="mailto:legal@skemly.app" className="underline text-slate-800 hover:text-slate-600">legal@skemly.app</a></p>
            </div>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-3">2. Datos que recogemos</h2>
            <p>Recogemos las siguientes categorías de datos personales:</p>

            <div className="mt-4 space-y-4">
              <div>
                <h3 className="font-semibold text-slate-800 mb-1">2.1 Datos de cuenta</h3>
                <ul className="list-disc pl-5 space-y-1 text-slate-700">
                  <li><strong>Dirección de email:</strong> utilizada para identificación, autenticación y comunicaciones transaccionales.</li>
                  <li><strong>Contraseña (hash bcrypt):</strong> almacenamos únicamente el hash irreversible de tu contraseña; nunca la contraseña en texto plano.</li>
                  <li><strong>Nombre:</strong> opcional, utilizado para personalizar la interfaz.</li>
                  <li><strong>Fecha de aceptación de los Términos de Servicio:</strong> registro de conformidad legal.</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-slate-800 mb-1">2.2 Contenido de diagramas</h3>
                <ul className="list-disc pl-5 space-y-1 text-slate-700">
                  <li><strong>Texto DSL de diagramas:</strong> el contenido de los diagramas que creas y guardas en el Servicio. Necesario para prestar el servicio de sincronización en la nube.</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-slate-800 mb-1">2.3 Datos técnicos y de sesión</h3>
                <ul className="list-disc pl-5 space-y-1 text-slate-700">
                  <li><strong>Dirección IP:</strong> recogida para el control de límites de uso (rate limiting) y para la seguridad del Servicio. Se conserva en nuestra base de datos con fines de seguridad.</li>
                  <li><strong>Tokens de sesión (JWT):</strong> almacenados como cookies HttpOnly en tu navegador para mantener tu sesión autenticada.</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-slate-800 mb-1">2.4 Datos de pago</h3>
                <ul className="list-disc pl-5 space-y-1 text-slate-700">
                  <li><strong>Stripe Customer ID y Subscription ID:</strong> identificadores generados por Stripe para gestionar tu suscripción. Skemly <em>no almacena</em> datos de tarjetas de crédito o débito; estos son gestionados íntegramente por Stripe.</li>
                </ul>
              </div>
            </div>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-3">3. Base legal del tratamiento</h2>
            <p>El tratamiento de tus datos personales se basa en las siguientes bases jurídicas previstas en el RGPD:</p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="text-left px-4 py-2 text-slate-700 font-semibold">Finalidad</th>
                    <th className="text-left px-4 py-2 text-slate-700 font-semibold">Base legal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="px-4 py-2 text-slate-600">Prestación del servicio (cuenta, diagramas, sincronización)</td>
                    <td className="px-4 py-2 text-slate-600">Ejecución de contrato — Art. 6.1.b RGPD</td>
                  </tr>
                  <tr className="bg-slate-50/50">
                    <td className="px-4 py-2 text-slate-600">Facturación y gestión de suscripción</td>
                    <td className="px-4 py-2 text-slate-600">Ejecución de contrato — Art. 6.1.b RGPD</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 text-slate-600">Seguridad, prevención de fraude y rate limiting</td>
                    <td className="px-4 py-2 text-slate-600">Interés legítimo — Art. 6.1.f RGPD</td>
                  </tr>
                  <tr className="bg-slate-50/50">
                    <td className="px-4 py-2 text-slate-600">Comunicaciones transaccionales (verificación, notificaciones)</td>
                    <td className="px-4 py-2 text-slate-600">Ejecución de contrato — Art. 6.1.b RGPD</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 text-slate-600">Cumplimiento de obligaciones legales</td>
                    <td className="px-4 py-2 text-slate-600">Obligación legal — Art. 6.1.c RGPD</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-3">4. Finalidad del tratamiento</h2>
            <p>Utilizamos tus datos personales para las siguientes finalidades:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1 text-slate-700">
              <li>Crear y gestionar tu cuenta de usuario.</li>
              <li>Prestar el servicio de diagramación y sincronización en la nube.</li>
              <li>Procesar pagos y gestionar tu suscripción a través de Stripe.</li>
              <li>Enviarte comunicaciones transaccionales (verificación de email, notificaciones de cuenta, cambios en los Términos o Política de Privacidad).</li>
              <li>Garantizar la seguridad del Servicio y prevenir usos fraudulentos o abusivos.</li>
              <li>Cumplir con las obligaciones legales aplicables.</li>
            </ul>
            <p className="mt-3">
              No utilizamos tus datos para publicidad ni los vendemos a terceros.
            </p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-3">5. Encargados del tratamiento (subprocesadores)</h2>
            <p>
              Para prestar el Servicio, compartimos datos con los siguientes proveedores de confianza,
              que actúan como encargados del tratamiento bajo acuerdos que garantizan el cumplimiento del RGPD:
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="text-left px-4 py-2 text-slate-700 font-semibold">Proveedor</th>
                    <th className="text-left px-4 py-2 text-slate-700 font-semibold">Función</th>
                    <th className="text-left px-4 py-2 text-slate-700 font-semibold">País</th>
                    <th className="text-left px-4 py-2 text-slate-700 font-semibold">Garantía</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="px-4 py-2 text-slate-600 font-medium">Anthropic Ireland, Ltd.</td>
                    <td className="px-4 py-2 text-slate-600">Procesamiento de IA (Claude)</td>
                    <td className="px-4 py-2 text-slate-600">EE.UU. / Irlanda</td>
                    <td className="px-4 py-2 text-slate-600">SCCs (Módulos 2 y 3, DPA incorporado en sus términos comerciales)</td>
                  </tr>
                  <tr className="bg-slate-50/50">
                    <td className="px-4 py-2 text-slate-600 font-medium">Neon Inc.</td>
                    <td className="px-4 py-2 text-slate-600">Base de datos PostgreSQL</td>
                    <td className="px-4 py-2 text-slate-600">EE.UU.</td>
                    <td className="px-4 py-2 text-slate-600">Cláusulas Contractuales Estándar (SCCs)</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 text-slate-600 font-medium">Vercel Inc.</td>
                    <td className="px-4 py-2 text-slate-600">Hosting y funciones serverless</td>
                    <td className="px-4 py-2 text-slate-600">EE.UU.</td>
                    <td className="px-4 py-2 text-slate-600">Cláusulas Contractuales Estándar (SCCs)</td>
                  </tr>
                  <tr className="bg-slate-50/50">
                    <td className="px-4 py-2 text-slate-600 font-medium">Stripe Inc.</td>
                    <td className="px-4 py-2 text-slate-600">Procesamiento de pagos</td>
                    <td className="px-4 py-2 text-slate-600">EE.UU. / Irlanda</td>
                    <td className="px-4 py-2 text-slate-600">SCCs + EU-U.S. Data Privacy Framework (DPF)</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 text-slate-600 font-medium">Resend</td>
                    <td className="px-4 py-2 text-slate-600">Email transaccional</td>
                    <td className="px-4 py-2 text-slate-600">EE.UU.</td>
                    <td className="px-4 py-2 text-slate-600">Cláusulas Contractuales Estándar (SCCs)</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm text-slate-600">
              Todos estos proveedores están sujetos a acuerdos de encargo del tratamiento que los
              obligan a tratar los datos únicamente según nuestras instrucciones y a implementar
              medidas técnicas y organizativas adecuadas.
            </p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-3">6. Retención de datos</h2>
            <ul className="list-disc pl-5 space-y-2 text-slate-700">
              <li><strong>Datos de cuenta y diagramas:</strong> se conservan mientras la cuenta esté activa.</li>
              <li><strong>Datos de IP (rate limiting):</strong> se conservan durante un máximo de 90 días y se eliminan automáticamente.</li>
              <li><strong>Tras solicitud de baja:</strong> los datos se eliminan en un plazo máximo de 30 días desde la solicitud, salvo aquellos que deban conservarse por obligación legal (p. ej., registros de facturación durante el período exigido por la normativa fiscal aplicable).</li>
            </ul>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-3">7. Transferencias internacionales de datos</h2>
            <p>
              Dado que algunos de nuestros subprocesadores están ubicados en los Estados Unidos, tus
              datos pueden ser transferidos fuera del Espacio Económico Europeo (EEE). Estas
              transferencias están amparadas por las <strong>Cláusulas Contractuales Estándar (SCCs)</strong>
              aprobadas por la Comisión Europea y, en el caso de Stripe, también por el <strong>EU-U.S. Data
              Privacy Framework (DPF)</strong>. Ambos mecanismos garantizan un nivel de protección equivalente
              al exigido por el RGPD. Privacy Shield no se utiliza por ninguno de nuestros proveedores.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-3">8. Tus derechos</h2>
            <p>Como usuario residente en la Unión Europea, tienes los siguientes derechos en relación con tus datos personales:</p>
            <ul className="list-disc pl-5 mt-2 space-y-2 text-slate-700">
              <li><strong>Acceso (Art. 15 RGPD):</strong> obtener confirmación de si tratamos tus datos y recibir una copia de los mismos.</li>
              <li><strong>Rectificación (Art. 16 RGPD):</strong> solicitar la corrección de datos inexactos o incompletos.</li>
              <li><strong>Supresión (Art. 17 RGPD):</strong> solicitar la eliminación de tus datos personales («derecho al olvido»).</li>
              <li><strong>Portabilidad (Art. 20 RGPD):</strong> recibir tus datos en un formato estructurado y legible por máquina, y transmitirlos a otro responsable.</li>
              <li><strong>Oposición (Art. 21 RGPD):</strong> oponerte al tratamiento basado en interés legítimo.</li>
              <li><strong>Limitación del tratamiento (Art. 18 RGPD):</strong> solicitar la restricción del tratamiento en determinadas circunstancias.</li>
            </ul>
            <p className="mt-4">
              Para ejercer cualquiera de estos derechos, contacta con nosotros en{' '}
              <a href="mailto:legal@skemly.app" className="underline text-slate-800 hover:text-slate-600">legal@skemly.app</a>.
              Responderemos en un plazo máximo de 30 días.
            </p>
            <p className="mt-3">
              Si consideras que el tratamiento de tus datos no cumple con la normativa, tienes derecho
              a presentar una reclamación ante la{' '}
              <a href="https://www.aepd.es" target="_blank" rel="noopener noreferrer" className="underline text-slate-800 hover:text-slate-600">
                Agencia Española de Protección de Datos (AEPD)
              </a>.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-3">9. Cookies</h2>
            <p>
              Skemly utiliza únicamente las cookies estrictamente necesarias para el funcionamiento
              del Servicio:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-2 text-slate-700">
              <li>
                <strong>Cookie de sesión de autenticación:</strong> cookie HttpOnly y SameSite=Lax que
                contiene el token JWT de tu sesión. Permite mantenerte autenticado entre visitas.
                Esta cookie no es transferida a terceros y no contiene datos de seguimiento.
              </li>
            </ul>
            <p className="mt-3">
              No utilizamos cookies de análisis, publicidad, seguimiento de terceros ni widgets de
              redes sociales. No existe ningún sistema de seguimiento o analítica en el Servicio.
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-3">10. Cambios en la Política de Privacidad</h2>
            <p>
              Podemos actualizar esta Política de Privacidad periódicamente para reflejar cambios en
              el Servicio, en la legislación aplicable o en nuestras prácticas de tratamiento de datos.
            </p>
            <p className="mt-3">
              Los cambios materiales te serán notificados por email con un mínimo de <strong>30 días
              de antelación</strong> a su entrada en vigor. La fecha de «última actualización» al
              inicio de este documento siempre indicará cuándo fue revisada por última vez.
            </p>
            <p className="mt-3">
              El uso continuado del Servicio tras la entrada en vigor de los cambios implicará la
              aceptación de la nueva Política de Privacidad.
            </p>
          </section>

          {/* Contact */}
          <section className="border-t border-slate-200 pt-6">
            <h2 className="text-lg font-bold text-slate-900 mb-3">Contacto</h2>
            <p>
              Para cualquier consulta relacionada con esta Política de Privacidad o para ejercer
              tus derechos, contacta con nosotros en:{' '}
              <a href="mailto:legal@skemly.app" className="underline text-slate-800 hover:text-slate-600">legal@skemly.app</a>
            </p>
          </section>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white mt-12">
        <div className="max-w-3xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <span>© 2026 Skemly. Todos los derechos reservados.</span>
          <div className="flex items-center gap-4">
            <a href="/terms" className="hover:text-slate-700 transition-colors">Términos de Servicio</a>
            <a href="/privacy" className="hover:text-slate-700 transition-colors font-medium text-slate-700">Política de Privacidad</a>
            <a href="/" className="hover:text-slate-700 transition-colors">Volver al editor</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
