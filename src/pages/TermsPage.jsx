import { ArrowLeft } from 'lucide-react'

export default function TermsPage() {
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
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Términos de Servicio</h1>
          <p className="text-sm text-slate-500">Última actualización: 13 de marzo de 2026</p>
        </div>

        <div className="prose prose-slate max-w-none space-y-8 text-slate-700 leading-relaxed">

          {/* 1 */}
          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-3">1. Objeto y aceptación</h2>
            <p>
              Los presentes Términos de Servicio (en adelante, «los Términos») regulan el acceso y uso del
              servicio Skemly, disponible en <strong>skemly.app</strong>, una herramienta de diagramación
              asistida por inteligencia artificial (en adelante, «el Servicio»), operada por Skemly.
            </p>
            <p className="mt-3">
              El acceso o uso del Servicio implica la aceptación plena y sin reservas de estos Términos.
              Al crear una cuenta, el usuario declara haber leído, comprendido y aceptado los presentes
              Términos, así como la <a href="/privacy" className="underline text-slate-800 hover:text-slate-600">Política de Privacidad</a>.
              Si no estás de acuerdo con alguno de los términos, no debes utilizar el Servicio.
            </p>
            <p className="mt-3">
              El uso del Servicio está disponible para personas mayores de 16 años. Al registrarte,
              confirmas que cumples con este requisito de edad.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-3">2. Descripción del servicio</h2>
            <p>
              Skemly es una herramienta de diagramación nativa para inteligencia artificial que permite
              a los usuarios crear, editar y compartir diagramas técnicos y de arquitectura mediante un
              lenguaje de dominio específico (DSL) y asistencia de modelos de IA.
            </p>
            <p className="mt-3">El Servicio incluye, entre otras, las siguientes funcionalidades:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1 text-slate-700">
              <li>Editor de diagramas basado en DSL con renderizado en tiempo real.</li>
              <li>Asistente de IA para generación y edición de diagramas mediante lenguaje natural.</li>
              <li>Exportación de diagramas en formato SVG y PNG.</li>
              <li>Compartición de diagramas mediante enlaces públicos.</li>
              <li>Sincronización en la nube de sesiones (en planes de pago).</li>
            </ul>
            <p className="mt-3">
              Skemly se reserva el derecho de modificar, suspender o interrumpir, temporal o
              definitivamente, el Servicio o cualquiera de sus funcionalidades, con o sin previo aviso.
            </p>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-3">3. Planes y pagos</h2>

            <h3 className="font-semibold text-slate-800 mt-4 mb-2">3.1 Planes disponibles</h3>
            <p>Skemly ofrece los siguientes planes de suscripción:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1 text-slate-700">
              <li><strong>Free:</strong> Acceso gratuito con límites de uso diarios (20 peticiones IA/día, 2 adjuntos/día). Sin sincronización en la nube. Las exportaciones incluyen una marca de agua.</li>
              <li><strong>Starter — $12/mes:</strong> 50 peticiones IA/día, 10 adjuntos/día, sincronización en la nube, exportaciones sin marca de agua, soporte por email.</li>
              <li><strong>Pro — $24/mes:</strong> Peticiones IA ilimitadas, adjuntos ilimitados, sincronización en la nube, exportaciones sin marca de agua, soporte prioritario.</li>
            </ul>
            <p className="mt-3">Los precios se indican en dólares estadounidenses (USD) e incluyen los impuestos aplicables cuando así lo exija la legislación.</p>

            <h3 className="font-semibold text-slate-800 mt-4 mb-2">3.2 Facturación</h3>
            <p>
              La facturación de los planes de pago es mensual y se realiza a través de <strong>Stripe</strong>,
              proveedor externo de servicios de pago. Al suscribirte a un plan de pago, autorizas a Stripe
              a cargar el importe correspondiente en el método de pago proporcionado al inicio de cada
              período de facturación.
            </p>
            <p className="mt-3">
              Skemly no almacena datos de tarjetas de crédito ni débito. Todos los datos de pago son
              gestionados directamente por Stripe de acuerdo con los estándares PCI-DSS.
            </p>

            <h3 className="font-semibold text-slate-800 mt-4 mb-2">3.3 Cancelación</h3>
            <p>
              El usuario puede cancelar su suscripción en cualquier momento desde el portal de facturación
              accesible en la página de planes. La cancelación surtirá efecto al final del período de
              facturación en curso. No se realizan reembolsos por los períodos parciales ya facturados.
            </p>

            <h3 className="font-semibold text-slate-800 mt-4 mb-2">3.4 Cambios de precio</h3>
            <p>
              Skemly se reserva el derecho de modificar los precios de los planes con un preaviso mínimo
              de 30 días por email. Los cambios de precio no afectarán a las suscripciones activas hasta
              el inicio del siguiente período de facturación.
            </p>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-3">4. Uso aceptable</h2>
            <p>El usuario se compromete a utilizar el Servicio de manera lícita y de buena fe. Queda expresamente prohibido:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1 text-slate-700">
              <li>Usar el Servicio para actividades ilegales o que vulneren derechos de terceros.</li>
              <li>Enviar, generar o almacenar contenido que sea difamatorio, obsceno, amenazante, fraudulento o que infrinja derechos de propiedad intelectual.</li>
              <li>Intentar acceder de forma no autorizada a sistemas, cuentas o datos de otros usuarios.</li>
              <li>Realizar ingeniería inversa, descompilar o desensamblar el Servicio o cualquiera de sus componentes.</li>
              <li>Usar el Servicio para enviar comunicaciones no solicitadas (spam) o para llevar a cabo actividades de phishing.</li>
              <li>Sobrecargar, saturar o interferir con la infraestructura del Servicio mediante ataques automatizados, scrapers o cualquier método similar.</li>
              <li>Revender, sublicenciar o explotar comercialmente el acceso al Servicio sin autorización previa por escrito.</li>
              <li>Eludir los límites de uso establecidos en cada plan mediante el uso de múltiples cuentas u otros mecanismos.</li>
            </ul>
            <p className="mt-3">
              El incumplimiento de estas normas puede dar lugar a la suspensión o cancelación inmediata
              de la cuenta, sin perjuicio de las acciones legales que pudieran corresponder.
            </p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-3">5. Propiedad intelectual</h2>

            <h3 className="font-semibold text-slate-800 mt-4 mb-2">5.1 Contenido del usuario</h3>
            <p>
              El usuario conserva todos los derechos de propiedad intelectual sobre el contenido que crea
              mediante el Servicio, incluyendo los diagramas y el código DSL. Skemly no reivindica ningún
              derecho de propiedad sobre el contenido generado por los usuarios.
            </p>
            <p className="mt-3">
              Al usar el Servicio, el usuario otorga a Skemly una licencia limitada, no exclusiva y
              no transferible para almacenar, reproducir y transmitir dicho contenido únicamente con
              el fin de prestar el Servicio.
            </p>

            <h3 className="font-semibold text-slate-800 mt-4 mb-2">5.2 Propiedad de Skemly</h3>
            <p>
              El Servicio, incluyendo su código fuente, diseño, logotipos, marca, interfaz y documentación,
              es propiedad exclusiva de Skemly y está protegido por las leyes de propiedad intelectual
              aplicables. El usuario no adquiere ningún derecho sobre estos elementos más allá del uso
              del Servicio conforme a estos Términos.
            </p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-3">6. IA y procesamiento de contenido</h2>
            <p>
              El Servicio utiliza modelos de inteligencia artificial proporcionados por <strong>Anthropic, PBC</strong>
              (Claude) para procesar las solicitudes del usuario y generar o modificar diagramas.
            </p>
            <p className="mt-3">
              Al usar las funciones de IA, el usuario acepta que el contenido de sus peticiones
              (incluido el texto del diagrama DSL) puede ser transmitido a los servidores de Anthropic
              para su procesamiento. Este procesamiento se rige por los{' '}
              <a href="https://www.anthropic.com/legal/consumer-terms" target="_blank" rel="noopener noreferrer" className="underline text-slate-800 hover:text-slate-600">Términos de Uso de Anthropic</a>.
            </p>
            <p className="mt-3">
              De acuerdo con los <a href="https://www.anthropic.com/legal/commercial-terms" target="_blank" rel="noopener noreferrer" className="underline text-slate-800 hover:text-slate-600">Términos Comerciales de Anthropic</a>, el contenido enviado
              a través de la API no se utiliza para entrenar sus modelos. Esta prohibición está
              recogida expresamente en el acuerdo de tratamiento de datos (DPA) suscrito con Anthropic.
            </p>
            <p className="mt-3">
              Los resultados generados por la IA son de naturaleza automática y pueden contener
              imprecisiones. El usuario es responsable de revisar y validar el contenido generado
              antes de utilizarlo.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-3">7. Limitación de responsabilidad</h2>
            <p>
              El Servicio se proporciona «tal cual» (<em>as is</em>) y «según disponibilidad», sin garantías
              de ningún tipo, expresas o implícitas, incluyendo, sin limitación, garantías de
              comerciabilidad, idoneidad para un propósito particular o ausencia de infracción.
            </p>
            <p className="mt-3">
              Skemly no garantiza que el Servicio sea ininterrumpido, libre de errores, seguro o que
              los resultados obtenidos sean precisos o fiables.
            </p>
            <p className="mt-3">
              En la máxima medida permitida por la legislación aplicable, Skemly no será responsable
              de daños indirectos, incidentales, especiales, consecuentes o punitivos, incluyendo,
              sin limitación, pérdida de beneficios, datos, fondo de comercio u otras pérdidas
              intangibles, derivadas del uso o la imposibilidad de usar el Servicio.
            </p>
            <p className="mt-3">
              La responsabilidad total de Skemly ante el usuario no excederá, en ningún caso, el
              importe pagado por el usuario durante los tres (3) meses anteriores al evento que
              da lugar a la reclamación, o cincuenta dólares (50 USD) si el usuario utiliza el
              plan gratuito.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-3">8. Cancelación y baja</h2>

            <h3 className="font-semibold text-slate-800 mt-4 mb-2">8.1 Por el usuario</h3>
            <p>
              El usuario puede cancelar su cuenta y solicitar la eliminación de sus datos en cualquier
              momento enviando un email a <a href="mailto:legal@skemly.app" className="underline text-slate-800 hover:text-slate-600">legal@skemly.app</a>.
              Skemly procesará la solicitud en un plazo máximo de 30 días y eliminará los datos
              personales del usuario, salvo los que deban conservarse por obligación legal.
            </p>

            <h3 className="font-semibold text-slate-800 mt-4 mb-2">8.2 Por Skemly</h3>
            <p>
              Skemly se reserva el derecho de suspender o cancelar la cuenta de cualquier usuario
              que incumpla estos Términos, con o sin previo aviso dependiendo de la gravedad del
              incumplimiento. En caso de cancelación injustificada por parte de Skemly, se
              reembolsará el importe proporcional al tiempo no utilizado del período de facturación
              en curso.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-3">9. Modificaciones de los Términos</h2>
            <p>
              Skemly se reserva el derecho de modificar estos Términos en cualquier momento. Los
              cambios materiales se notificarán por email con un mínimo de <strong>30 días de antelación</strong>
              a la dirección de correo electrónico asociada a la cuenta del usuario.
            </p>
            <p className="mt-3">
              El uso continuado del Servicio tras la entrada en vigor de las modificaciones implicará
              la aceptación de los nuevos Términos. Si el usuario no está de acuerdo con los cambios,
              podrá cancelar su cuenta antes de la fecha de entrada en vigor.
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-3">10. Ley aplicable y jurisdicción</h2>
            <p>
              Los presentes Términos se rigen e interpretan de conformidad con el derecho español.
              Para la resolución de cualquier controversia derivada de estos Términos o del uso
              del Servicio, las partes se someten expresamente a los juzgados y tribunales de España,
              con renuncia expresa a cualquier otro fuero que pudiera corresponderles.
            </p>
            <p className="mt-3">
              Sin perjuicio de lo anterior, los usuarios que tengan la condición de consumidores
              en el ámbito de la Unión Europea podrán acudir a la plataforma de resolución de
              litigios en línea de la UE disponible en{' '}
              <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer" className="underline text-slate-800 hover:text-slate-600">ec.europa.eu/consumers/odr</a>.
            </p>
          </section>

          {/* Contact */}
          <section className="border-t border-slate-200 pt-6">
            <h2 className="text-lg font-bold text-slate-900 mb-3">Contacto</h2>
            <p>
              Para cualquier consulta relacionada con estos Términos, puedes contactarnos en:{' '}
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
            <a href="/terms" className="hover:text-slate-700 transition-colors font-medium text-slate-700">Términos de Servicio</a>
            <a href="/privacy" className="hover:text-slate-700 transition-colors">Política de Privacidad</a>
            <a href="/" className="hover:text-slate-700 transition-colors">Volver al editor</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
