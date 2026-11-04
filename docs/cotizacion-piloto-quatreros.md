# Cotización — Proyecto Quatreros

> **Documento para el cliente.** Versión de trabajo: 2026-11-03.
> En este documento conviven tres tipos de cifras: los **rangos de mercado** (secciones 3 y 8.1), que sirven como referencia de lo que cuesta contratar el mismo alcance en condiciones normales; el **precio de este proyecto** (sección 4), que es el valor ofrecido al cliente; y las **facilidades de pago** (sección 9). El precio de la sección 4 es un precio de lanzamiento y está sujeto a confirmación después de la reunión de alcance; no constituye una oferta definitiva hasta su firma.
> Moneda principal: **COP**. Los servicios internacionales se expresan en **USD** y se convierten a la TRM del día de pago.

## 1. Resumen

Quatreros es un ERP a medida para una productora y comercializadora de alimentos cárnicos. Cubre la operación desde la compra de materia prima hasta la venta en punto de venta, el reparto, la cartera y el registro de hechos económicos, con un asistente de IA integrado.

El proyecto se encuentra en **modo prototipo funcional**: los módulos principales están construidos y verificados, y está listo para iniciar una **prueba piloto** con usuarios y datos controlados antes de su operación definitiva.

Esta cotización cubre:

1. El valor del desarrollo y la puesta en producción.
2. La infraestructura mensual que debe seguir pagándose.
3. Los planes de mantenimiento y soporte.
4. Una referencia aparte para el sitio web que el cliente quiere desarrollar, cuyo alcance aún no está definido.
5. Cuánto costaría este mismo alcance en condiciones normales de mercado.
6. Por qué este precio no se compara con el de una suscripción mensual.
7. Las facilidades de pago disponibles.

## 2. Alcance funcional entregado

| Área               | Incluye                                                                                         |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| Acceso y seguridad | Inicio de sesión, segundo factor TOTP para roles sensibles, usuarios, roles, permisos y sedes   |
| Catálogo           | Productos fabricados y preparados, presentaciones, materias primas y precios con histórico      |
| Inventario         | Lotes, vencimientos, saldos por ubicación, kardex, trazabilidad, FEFO y traslados               |
| Compras            | Proveedores, órdenes de compra y recepción con lote de materia prima                            |
| Producción         | Recetas versionadas, órdenes, consumo real por lote, cierre y lote terminado                    |
| Pedidos y reparto  | Clientes, crédito, pedidos, despacho, entrega parcial, devolución e inspección                  |
| POS y caja         | Turnos, venta de productos y platos, pagos mixtos, comprobante interno y cierre con arqueo      |
| Cartera y recaudos | Antigüedad, abonos, recaudos, conciliación y exportación CSV                                    |
| Hechos económicos  | Registro inmutable de operaciones para una futura contabilidad                                  |
| Asistente IA       | Consultas con permisos y sede, preparación de materias primas y recetas con confirmación humana |
| Operación          | Auditoría, reportes operativos, monitoreo de salud y respaldos de base de datos                 |

### Fuera del alcance actual

- Facturación electrónica, impuestos y documentos fiscales. No es obligatoria para esta operación, según lo confirmado con el contador del cliente.
- Contabilidad formal, plan de cuentas y asientos contables.
- Nómina y liquidación de distribuidores.
- Integración con la DIAN.
- Aplicación móvil nativa.
- Escrituras autónomas de la IA sin confirmación humana.
- Carga masiva de datos históricos, salvo cotización aparte.

## 3. Cuánto costaría este proyecto en condiciones normales

Antes de hablar del valor de esta propuesta conviene responder otra pregunta: **cuánto cuesta construir un sistema así en el mercado**. No para justificar un precio, sino para que la comparación se haga contra el costo real de producir software y no contra la suscripción de un servicio ya empaquetado.

Un ERP con punto de venta, inventario por lote, producción, reparto, cartera y asistente de IA no se escribe en unas semanas. Abajo está el desglose del esfuerzo real.

### 3.1 Composición del esfuerzo

| Componente                                                                          | Horas     |
| ----------------------------------------------------------------------------------- | --------- |
| Análisis, arquitectura y modelo de datos                                            | 90        |
| Acceso, usuarios, roles, permisos y segundo factor                                  | 70        |
| Catálogo, presentaciones, precios e históricos                                      | 50        |
| Inventario por lote, FEFO, kardex y trazabilidad                                    | 140       |
| Compras, proveedores y recepción                                                    | 60        |
| Producción, recetas versionadas y consumo por lote                                  | 100       |
| Pedidos, crédito, despacho y reparto                                                | 90        |
| Punto de venta, turnos, pagos mixtos y arqueo                                       | 110       |
| Cartera, recaudos y conciliación                                                    | 70        |
| Hechos económicos y auditoría                                                       | 70        |
| Asistente de IA, herramientas y permisos                                            | 90        |
| Reportes y exportaciones                                                            | 50        |
| Pruebas automatizadas: unitarias, de integración, extremo a extremo y accesibilidad | 120       |
| Despliegue, integración continua, monitoreo y respaldos                             | 60        |
| Documentación y capacitación                                                        | 40        |
| **Total estimado**                                                                  | **1.210** |

### 3.2 Tarifas de mercado y valor resultante

En Colombia la hora de desarrollo se cobra en estos rangos, según quién lo haga:

| Tipo de proveedor                                      | Tarifa por hora         | Valor del alcance (1.210 h) |
| ------------------------------------------------------ | ----------------------- | --------------------------- |
| Profesional independiente sin experiencia en ERP       | `$ 35.000 – $ 43.000`   | `$ 42 – 52 M`               |
| Profesional independiente senior o estudio unipersonal | `$ 60.000 – $ 90.000`   | `$ 73 – 109 M`              |
| Estudio mediano, equipo de 3 a 6 personas              | `$ 100.000 – $ 140.000` | `$ 121 – 169 M`             |
| Casa de software o consultora                          | `$ 160.000 – $ 250.000` | `$ 194 – 302 M`             |

A esos valores el mercado les suma por separado la puesta en producción, la capacitación, el acompañamiento inicial y el mantenimiento mensual.

Como referencia adicional: un desarrollador senior en Colombia cuesta entre 8 y 15 millones de pesos al mes, ya cargado. Las 1.210 horas equivalen a unos siete meses de una sola persona, sin diseño, sin pruebas automatizadas y sin soporte.

### 3.3 Desarrollo e implementación en el escenario más económico

Los valores de esta sección corresponden al extremo más barato del mercado: un profesional independiente, sin equipo, con pruebas reducidas y sin acompañamiento posterior. Sirven como piso de comparación.

**Rango:** `$ 38.000.000 – $ 52.000.000 COP`

Incluye:

- Análisis y ajuste del alcance con el cliente.
- Configuración de la instancia de producción.
- Migraciones de base de datos y verificación de permisos.
- Ajustes de marca, textos y datos iniciales.
- Pruebas de aceptación del piloto.
- Documentación técnica y manual básico de uso.
- Acompañamiento durante la puesta en marcha.

El valor final depende de:

- cantidad de sedes y usuarios;
- datos iniciales que deba cargar el proveedor;
- integraciones adicionales;
- cambios de alcance solicitados después de la firma;
- acompañamiento presencial, si se requiere.

### 3.4 Puesta en producción y capacitación

**Rango:** `$ 4.000.000 – $ 6.000.000 COP`

Incluye:

- Despliegue en la infraestructura acordada.
- Configuración de dominio, HTTPS, correo y respaldos.
- Configuración del asistente y de su presupuesto de consumo.
- Capacitación remota por rol: administración, compras, producción, reparto, caja y cartera.
- Una sesión de acompañamiento durante la primera semana.

### 3.5 Acompañamiento del piloto

**Rango:** `$ 2.500.000 – $ 4.000.000 COP` por 30 días

Incluye:

- Acompañamiento durante la operación inicial.
- Corrección de errores del alcance entregado.
- Ajustes menores de configuración.
- Revisión semanal de incidencias y consumo de IA.

No incluye nuevas funcionalidades ni cambios de alcance.

### 3.6 Total de mercado para el mismo alcance

| Concepto                            | Rango de mercado    |
| ----------------------------------- | ------------------- |
| Desarrollo e implementación         | `$ 38 – 52 M`       |
| Puesta en producción y capacitación | `$ 4 – 6 M`         |
| Acompañamiento del piloto, 30 días  | `$ 2,5 – 4 M`       |
| **Total**                           | **`$ 44,5 – 62 M`** |

A partir del segundo año se suma el mantenimiento mensual, que en el mercado se cobra entre `$ 450.000` y `$ 1.500.000` según el nivel de servicio.

## 4. Precio para este proyecto

### 4.1 ERP Quatreros: desarrollo, puesta en producción y piloto

**`$ 6.400.000 COP` — pago de contado**

Incluye todo el alcance de la sección 2, más:

- análisis y ajuste del alcance con el cliente;
- configuración de la instancia de producción;
- migraciones de base de datos y verificación de permisos;
- ajustes de marca, textos y datos iniciales;
- despliegue con dominio y HTTPS;
- pruebas de aceptación del piloto;
- documentación técnica y manual básico de uso;
- capacitación remota por rol;
- acompañamiento durante los primeros 30 días;
- garantía de 60 días sobre errores del alcance entregado.

Alcance: una sede. El número de usuarios se confirma en la reunión de alcance.

No incluye: facturación electrónica, que no aplica a esta operación (sección 4.4), contabilidad formal, nómina, aplicación móvil, carga masiva de históricos, asistente de IA (sección 4.2) ni sitio web (sección 8).

### 4.2 Asistente de IA

**`+ $ 1.000.000 COP` — opcional**

Incluye:

- workspace de producción separado del de desarrollo;
- configuración del agente, sus herramientas y sus permisos;
- alcance por sede y por rol;
- límite de consumo mensual;
- pruebas con datos reales;
- capacitación del equipo.

El consumo de Anthropic se paga aparte y tiene techo mensual (sección 6). Es un precio de lanzamiento: cada herramienta nueva que se agregue después de la puesta en marcha se cotiza por separado.

### 4.3 Cambios de alcance

Cualquier funcionalidad que no esté en la sección 2 se cotiza antes de ejecutarse. La referencia de mercado para trabajo adicional es de `$ 100.000 – $ 150.000 COP/hora`, o por alcance cerrado cuando el cambio es grande.

### 4.4 Facturación electrónica: no aplica

La facturación electrónica **no está incluida** en los `$ 6.400.000` porque **no es obligatoria para esta operación**, según lo confirmado con el contador del cliente. El punto de venta emite un comprobante interno de venta, que es suficiente para el control de caja, cartera y arqueo.

Si en el futuro la operación queda obligada —por un cambio normativo, por un cambio de régimen tributario o por exigencia de un cliente corporativo—, se cotiza por separado. Es un proyecto en sí mismo y depende de terceros:

- selección de un proveedor tecnológico autorizado;
- resolución de numeración ante la DIAN;
- certificado digital;
- integración con el punto de venta y con cartera;
- pruebas de transmisión y de contingencia.

Mientras esa obligación no exista, incluirla sería un costo que el negocio no necesita.

### 4.5 Comparación con el valor de mercado

| Concepto                            | Mercado, escenario más económico | Este proyecto               |
| ----------------------------------- | -------------------------------- | --------------------------- |
| Desarrollo e implementación         | `$ 38 – 52 M`                    | `$ 6,4 M`                   |
| Puesta en producción y capacitación | `$ 4 – 6 M`                      | incluido                    |
| Acompañamiento del piloto           | `$ 2,5 – 4 M`                    | incluido                    |
| **Total**                           | **`$ 44,5 – 62 M`**              | **`$ 6,4 M`**               |
| **Diferencia**                      |                                  | **entre 86 % y 90 % menos** |

Esa diferencia no es un descuento de vitrina. Se explica por cuatro razones concretas:

1. **Relación previa con la familia.** El proyecto se entrega con un precio de consideración, no de lista.
2. **Precio de lanzamiento.** Es el primer cliente de la operación real del sistema, y el proyecto entra al portafolio del proveedor.
3. **Alcance cerrado.** Una sede, sin integraciones de terceros, sin carga masiva de históricos y sin cambios abiertos.
4. **Sin intermediarios.** No hay agencia, gerente de proyecto ni equipo que sostener: el trabajo lo hace una sola persona.

Este valor aplica solo a este proyecto y a la fecha de esta propuesta. No es un precio de lista ni un compromiso para proyectos futuros.

## 5. Por qué esto no se compara con una suscripción como Loggro

### 5.1 Son dos cosas distintas

Una suscripción mensual es un **alquiler**: se paga mientras se usa y, al terminar, no queda nada en el patrimonio. El proveedor decide qué funciones existen y cuándo cambian.

Un sistema a medida es un **activo**: se paga una vez, queda en propiedad del cliente y se adapta a cómo opera el negocio, no al revés.

Comparar el pago único contra la cuota mensual es comparar el precio de una casa con el de un arriendo. Ambos son válidos, pero no son la misma decisión.

### 5.2 Qué conviene comparar realmente

Para que la comparación sea justa deben entrar en la cuenta:

- el valor inicial;
- el mantenimiento mensual;
- la infraestructura y el dominio;
- el costo por usuario adicional a medida que crece el equipo;
- el costo de adaptar el proceso del negocio al software;
- el costo de salir: qué pasa con los datos y con la operación si se cambia de proveedor.

Ese último punto casi nunca se compara y suele ser el más caro. Con una suscripción, al terminar el contrato se pierde el sistema. Con un desarrollo propio, el código, la base de datos y el dominio quedan en manos del cliente.

### 5.3 La comparación honesta

No todos los negocios necesitan un sistema a medida. Para una operación estándar, con un solo punto y sin procesos particulares, una suscripción puede costar menos en dinero y ser la decisión correcta.

La diferencia aparece cuando el negocio tiene una operación que no encaja en el estándar:

- producción por lote, con vencimientos y trazabilidad;
- venta en mostrador y reparto sobre el mismo inventario;
- cartera con crédito y recaudo por cliente;
- necesidad de que los datos y el código sean propios;
- crecimiento en sedes sin pagar más por usuario.

Ahí el software empaquetado obliga a cambiar la operación, y el costo de ese cambio no aparece en la factura mensual.

### 5.4 Cuándo una suscripción es la mejor decisión

- La operación es estándar y no va a cambiar.
- Hay un solo punto de venta y un equipo pequeño.
- No interesa tener el código ni la base de datos.
- No hay procesos propios que el software deba respetar.
- Se prefiere pagar poco cada mes y no invertir en un activo.

### 5.5 Cuándo el sistema a medida es la mejor decisión

- La operación tiene reglas propias que el software estándar no contempla.
- Se necesita integrar compras, producción, inventario, venta y cartera en un solo flujo.
- Se espera abrir sedes o crecer en usuarios.
- Se quiere ser dueño del código, de los datos y del dominio.
- Se quiere usar IA sobre los datos propios del negocio.

Este documento no incluye precios de Loggro porque dependen del plan, del número de usuarios y de los módulos contratados. La comparación debe hacerse con la cotización real que el cliente ya recibió, sumando tres o cuatro años y el costo de adaptación, no solo la cuota del primer mes.

## 6. Infraestructura mensual

Estos valores son **costos operativos**, no honorarios de mantenimiento. Pueden pagarse directamente por el cliente o administrarse por el proveedor con un fee adicional.

| Concepto                      | Referencia              | Costo mensual estimado              |
| ----------------------------- | ----------------------- | ----------------------------------- |
| Servidor de aplicación        | Render Web Starter      | USD 7                               |
| Base de datos PostgreSQL      | Render PostgreSQL Basic | USD 6                               |
| Tarea programada de retención | Render Cron             | USD 1                               |
| Monitoreo externo             | UptimeRobot             | USD 0 en plan gratuito              |
| Dominio                       | Prorrateado             | COP 4.000 – 7.000/mes               |
| Consumo del asistente IA      | Anthropic, con techo    | Variable; techo aprobado USD 30/mes |
| **Total sin IA**              |                         | **≈ USD 14/mes + dominio**          |
| **Total con techo de IA**     |                         | **≈ USD 44/mes**                    |

Notas:

- El costo de IA es variable. El techo de USD 30/mes es una protección, no un gasto esperado.
- Si se elige una base de datos con más memoria, el costo sube aproximadamente USD 13/mes adicionales.
- Si el cliente prefiere Supabase, el plan pago parte de USD 25/mes y reemplaza la base de Render.
- Los precios de Render, Anthropic y dominio pueden cambiar. Se facturarán al costo vigente.

## 7. Mantenimiento y soporte

El mantenimiento cubre la operación, no el desarrollo de nuevas funciones. Se presentan dos escalas: la que se cobra en condiciones normales de mercado y la que aplica a este proyecto.

### 7.1 Planes recomendados en condiciones normales

| Plan         | Incluye                                                                                                                                   | Valor mensual propuesto |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| **Básico**   | Monitoreo de disponibilidad, verificación de respaldos, actualizaciones de seguridad, revisión mensual y hasta 2 horas de ajustes menores | `$ 450.000 COP`         |
| **Estándar** | Básico + hasta 4 horas de cambios menores + revisión del consumo de IA + respuesta en 24–48 h hábiles                                     | `$ 850.000 COP`         |
| **Premium**  | Estándar + hasta 8 horas + prioridad de atención + informe mensual ampliado + gestión completa de infraestructura                         | `$ 1.500.000 COP`       |

### 7.2 Planes para este proyecto

Cubren **las dos plataformas**: el ERP y el sitio web.

| Plan         | Incluye                                                                                                                                                                                                             | Valor mensual   |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| **Básico**   | Monitoreo de disponibilidad, verificación semanal de respaldos, actualizaciones de seguridad críticas, hasta 1 hora mensual para incidencias del alcance entregado y soporte por correo o WhatsApp en horario hábil | `$ 250.000 COP` |
| **Estándar** | Básico + hasta 2 horas mensuales de ajustes menores, revisión del consumo de IA, atención de incidencias críticas con respuesta en 24–48 h hábiles y revisión mensual breve                                         | `$ 500.000 COP` |
| **Premium**  | Estándar + hasta 4 horas mensuales, prioridad de atención, informe mensual, gestión completa de la infraestructura y acompañamiento en cambios operativos menores                                                   | `$ 900.000 COP` |

Notas sobre la escala de este proyecto:

- Es un **precio de lanzamiento** y aplica solo a este cliente.
- Las horas incluidas **no se acumulan** de un mes a otro.
- El plan Básico no incluye cambios de alcance, mejoras ni funcionalidades nuevas.
- El trabajo que exceda las horas incluidas se cotiza a `$ 100.000 – $ 150.000 COP/hora` o por alcance cerrado, con aprobación previa.

Todos los planes incluyen:

- Monitoreo de `/health` y `/ready`.
- Verificación de respaldos.
- Actualización de dependencias críticas.
- Gestión de la API key y del presupuesto de IA.
- Canal de soporte acordado.
- Corrección de errores del alcance entregado.

No incluyen:

- Nuevas funcionalidades o módulos.
- Cambios de diseño.
- Carga de datos.
- Capacitación adicional.
- Soporte 24/7.
- Cambios solicitados por terceros.
- Licencias de software de terceros.

Los trabajos fuera del plan se cotizan por hora o por alcance, con aprobación previa.

## 8. Sitio web del cliente

El sitio web es un proyecto independiente del ERP y su alcance aún no está definido.

### 8.1 Referencias de mercado

Los siguientes valores son **referencias de mercado** para orientar la conversación.

| Tipo de sitio     | Alcance típico                                                            | Rango estimado                    |
| ----------------- | ------------------------------------------------------------------------- | --------------------------------- |
| Landing page      | Una página, presentación, contacto y formulario                           | `$ 2.500.000 – $ 4.500.000 COP`   |
| Sitio corporativo | 5–8 páginas, servicios, blog o noticias, contacto y SEO básico            | `$ 5.000.000 – $ 9.000.000 COP`   |
| Catálogo o tienda | Catálogo de productos, carrito, pagos y administración                    | `$ 12.000.000 – $ 25.000.000 COP` |
| Sitio a medida    | Integraciones, portal de clientes, cotizador o funcionalidades especiales | Cotización aparte                 |

Costos mensuales habituales del sitio web:

| Concepto                        | Rango estimado                  |
| ------------------------------- | ------------------------------- |
| Hosting y dominio               | `$ 150.000 – $ 350.000 COP/mes` |
| Mantenimiento y actualizaciones | `$ 250.000 – $ 600.000 COP/mes` |
| Dominio                         | `$ 50.000 – $ 90.000 COP/año`   |
| Correo corporativo              | Según proveedor                 |

El valor final depende de:

- número de páginas y secciones;
- textos, fotos y videos;
- idioma;
- integración con el ERP o con medios de pago;
- posicionamiento SEO;
- capacitación y cargue de contenido.

### 8.2 Precio para este proyecto

| Opción                                   | Incluye                                                                                                                                           | Valor             |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| **Landing**                              | Una página con presentación, productos destacados, contacto, formulario y botón de WhatsApp; diseño adaptable a celular                           | `$ 1.500.000 COP` |
| **Landing + catálogo + página del hijo** | Landing principal, catálogo de productos con carrito y pedido enviado por WhatsApp, página del hijo del cliente y asistente virtual en esa página | `$ 2.200.000 COP` |

Alcance y condiciones:

- **Cómo funciona el catálogo:** el visitante arma su pedido en un carrito y, al confirmar, el sitio genera el mensaje con los productos, cantidades y presentaciones, y lo envía por WhatsApp al negocio. **La plataforma no procesa pagos ni cobra en línea**: la venta se cierra por WhatsApp, igual que hoy.
- El catálogo incluye un panel básico para cargar productos, precios, presentaciones y fotos.
- Conectar el catálogo con los productos y precios del ERP, para no duplicar la carga, es una decisión que se define en la reunión de alcance; si se requiere, se cotiza aparte.
- El asistente virtual de la página del hijo se incluye **sin costo adicional**, como gesto comercial del proveedor. No incluye herramientas nuevas del asistente ni su consumo mensual.
- No incluye: fotografía de producto, redacción de textos legales, posicionamiento SEO avanzado, carga masiva de productos, pasarela de pagos ni cuentas de usuario para clientes.
- El hosting y el dominio del sitio se pagan aparte, según la tabla de la sección 8.1.

### 8.3 Comparación con el valor de mercado

| Concepto                                   | Mercado           | Este proyecto |
| ------------------------------------------ | ----------------- | ------------- |
| Landing principal                          | `$ 2,5 – 4,5 M`   | `$ 1,5 M`     |
| Segunda landing                            | `$ 1,5 – 2,5 M`   | incluida      |
| Catálogo con carrito y pedido por WhatsApp | `$ 5 – 9 M`       | incluido      |
| Asistente virtual en la página             | `$ 1 – 3 M`       | sin costo     |
| **Total**                                  | **`$ 10 – 19 M`** | **`$ 2,2 M`** |

## 9. Forma de pago

### Proyecto ERP

Cuando se paga al contado, el valor se distribuye por hitos de avance:

| Momento                        | Porcentaje | Sobre `$ 6.400.000` |
| ------------------------------ | ---------- | ------------------- |
| Firma y levantamiento          | 40 %       | `$ 2.560.000`       |
| Aprobación del piloto          | 30 %       | `$ 1.920.000`       |
| Puesta en producción y entrega | 30 %       | `$ 1.920.000`       |

### Facilidad de pago

Para este proyecto se ofrecen tres formas de pago. Las tres incluyen exactamente el mismo alcance: lo único que cambia es el momento de pago.

| Opción                               | Estructura                               | Total         |
| ------------------------------------ | ---------------------------------------- | ------------- |
| **A — Contado**                      | Un solo pago, o por hitos de avance      | `$ 6.400.000` |
| **B — Entrada del 50 % + 6 cuotas**  | `$ 3.200.000` + 6 cuotas de `$ 556.000`  | `$ 6.536.000` |
| **C — Entrada del 30 % + 12 cuotas** | `$ 1.920.000` + 12 cuotas de `$ 403.100` | `$ 6.757.200` |

Cómo se leen esas cifras:

- La diferencia frente al contado **no es una mora ni un castigo**: es el costo de financiar el proyecto durante seis o doce meses. Equivale aproximadamente a un 1,2 % mensual sobre el saldo.
- En la opción B el sobrecosto total es de `$ 136.000`; en la opción C, de `$ 357.200`.
- El pago de contado siempre es la opción más económica.
- Si hay atraso en una cuota, no se cobra interés de mora: se suspende el acompañamiento y el mantenimiento hasta que el cliente se ponga al día.
- En cualquiera de las dos opciones a plazos, la **entrega completa de código, cuentas y llaves se realiza al terminar de pagar**. El piloto y la operación pueden empezar antes.

La misma facilidad aplica al asistente de IA, que puede pagarse junto con el ERP o por separado.

### Mantenimiento e infraestructura

- Mantenimiento: mensual, pagado por adelantado.
- Infraestructura: mensual, al costo, según el proveedor.
- IA: consumo variable, con techo mensual acordado.
- Dominio y licencias: anuales o según proveedor.

Los valores no incluyen impuestos. IVA, retenciones y demás obligaciones se aplican según la normativa vigente y la condición tributaria de las partes.

## 10. Condiciones

- **Vigencia de la propuesta:** 30 días.
- **Inicio:** contra firma y primer pago.
- **Cambios de alcance:** se cotizan y aprueban por escrito antes de ejecutarse.
- **Retrasos del cliente:** pueden ajustar el cronograma.
- **Soporte:** horario hábil acordado; no es un servicio 24/7.
- **Datos:** el cliente es responsable de la veracidad y legalidad de sus datos.
- **Respaldos:** se verifican, pero el cliente debe conservar copias independientes.
- **Seguridad:** las llaves y accesos de producción se rotan al finalizar el proyecto.
- **Terminación:** cualquiera de las partes puede terminar el mantenimiento con 30 días de aviso; se entregan datos y accesos.
- **Precio de lanzamiento:** el valor de la sección 4 aplica solo a este proyecto y a la fecha de esta propuesta.
- **Pago a plazos:** la entrega de código, cuentas y llaves se completa al terminar de pagar el proyecto.
- **Alcance cerrado:** lo que no esté en la sección 2 no se ejecuta sin cotización y aprobación escritas.

## 11. Entrega y propiedad

Al completar el pago del proyecto:

- El cliente recibe el código y la documentación del sistema.
- El cliente es dueño de su base de datos, dominio, cuentas de infraestructura y workspaces de IA.
- El proveedor conserva una **versión demo con datos ficticios** para portafolio, sin datos reales ni credenciales del cliente.
- El proveedor puede mencionar el proyecto en su portafolio, salvo acuerdo de confidencialidad.
- Las librerías y servicios de terceros conservan sus propias licencias.

## 12. Recomendación de despliegue

Para este producto se recomienda:

- **Un solo servicio en Render** que sirva la API y la aplicación web.
- **PostgreSQL en Render**, en la misma región.
- **Un cron de Render** para la retención del asistente.
- **UptimeRobot** apuntando a `/ready` como monitor externo.
- **Dominio propio** con HTTPS automático.

No se recomienda separar frontend y backend entre Vercel y Render para el piloto: agrega proxy, CORS, cookies y riesgo para el streaming del asistente. Si más adelante el tráfico lo exige, se puede evaluar una CDN o un VPS.

## 13. Siguiente paso

1. Reunión de alcance para confirmar sedes, usuarios, datos iniciales y sitio web.
2. Ajuste de esta cotización.
3. Firma y primer pago.
4. Configuración de infraestructura y dominio.
5. Piloto controlado.
6. Paso a producción y handoff.

## 14. Contacto

**Proveedor:** [nombre]
**Correo:** [correo]
**Teléfono:** [teléfono]
**Ciudad:** Cali, Colombia

---

**Nota:** este documento es una propuesta comercial. Los valores marcados como referencia deben confirmarse con el cliente y con los proveedores antes de la firma.
