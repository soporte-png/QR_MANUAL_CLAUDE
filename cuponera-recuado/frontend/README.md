# Integración de logos en el frontend

Este backend ahora expone los logos corporativos como archivos estáticos y permite actualizarlos mediante formularios `multipart/form-data`. A continuación se describe cómo consumir estos cambios desde el frontend.

## Cargar nuevos logos

1. **Endpoint**: `PUT /api/config/logos`
2. **Cabeceras**:
   - `Authorization: Bearer <token JWT>` (solo administradores).
   - `Content-Type: multipart/form-data` (el navegador la define automáticamente al usar `FormData`).
3. **Campos admitidos**:
   - `logo_empresa`
   - `logo_app`
   - `logo_login`

Cada campo es opcional y acepta un solo archivo de imagen. Los archivos se almacenan en `public/logos` con nombres versionados, y la respuesta devuelve la configuración completa con las URLs actualizadas. Si no se envía un campo, se conserva el valor existente.

### Ejemplo en JavaScript

```js
async function actualizarLogos({ logoEmpresaFile, logoAppFile, logoLoginFile }, token) {
  const formData = new FormData();

  if (logoEmpresaFile) {
    formData.append('logo_empresa', logoEmpresaFile);
  }
  if (logoAppFile) {
    formData.append('logo_app', logoAppFile);
  }
  if (logoLoginFile) {
    formData.append('logo_login', logoLoginFile);
  }

  const response = await fetch('/api/config/logos', {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: formData
  });

  if (!response.ok) {
    throw new Error('No fue posible actualizar los logos');
  }

  return response.json();
}
```

## Mostrar los logos en la aplicación

Los archivos almacenados están disponibles como contenido estático en el endpoint `/logos`. Las URLs devueltas por la API ya siguen este formato (`/logos/<nombre-del-archivo>`), por lo que bastará con asignarlas directamente a los elementos de imagen del frontend.

```jsx
<img src={config.logo_empresa} alt="Logo empresa" />
<img src={config.logo_app} alt="Logo aplicación" />
<img src={config.logo_login} alt="Logo pantalla de acceso" />
```

Si se necesita construir una URL absoluta (por ejemplo, cuando el frontend y el backend están en dominios distintos), concatene la raíz del backend:

```js
const url = `${process.env.REACT_APP_API_URL}${config.logo_empresa}`;
```

## Consideraciones adicionales

- Solo se aceptan archivos de imagen de hasta 5 MB.
- Para mantener los logos existentes basta con omitir el campo correspondiente en el `FormData`.
- Si se requiere limpiar un logo, primero actualice la configuración general desde el backend o registre una tarea dedicada (actualmente los valores se conservan cuando el campo queda vacío).
