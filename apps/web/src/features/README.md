# Funcionalidades

Una carpeta por módulo de negocio (`features/<modulo>/`), creada al construir su funcionalidad vertical:

```
features/inventario/
├── api.ts          llamadas tipadas con contratos de @quatreros/contracts
├── hooks.ts        consultas y mutaciones con TanStack Query
├── components/     componentes del módulo
└── pages/          pantallas montadas en el shell correspondiente (/erp, /pos o /ruta)
```

Reglas:

- Las validaciones del formulario usan el mismo esquema Zod del contrato; el servidor siempre vuelve a validar.
- Toda mutación con efecto en inventario, dinero o cartera usa `newIdempotencyKey()` una vez por intento y la reutiliza en reintentos.
- Montos y cantidades se muestran con `tabular` y con su unidad o presentación.
