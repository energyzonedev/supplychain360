# Publicar el sitio

Se entrega una URL pública. Revisado el 13 de octubre de 2026 en la
documentación oficial de cada servicio.

## Opción elegida: GitHub Pages

La mejor para este caso: el flujo es `git push`, la URL es estable y predecible,
no hay cuota diaria de publicaciones ni modelo de créditos, y la documentación no
menciona borrado por inactividad. Soporta JavaScript y archivos JSON sin
restricción. **El repositorio debe ser público** (en el plan gratuito, Pages solo
funciona así).

```bash
git init
git add .
git commit -m "SupplyChain 360 AI - A2U3"
git branch -M main
git remote add origin https://github.com/USUARIO/supplychain360.git
git push -u origin main
```

Después, en GitHub: **Settings → Pages → Build and deployment → Source:
"Deploy from a branch" → rama `main` → carpeta `/(root)` → Save.**

La URL queda como `https://USUARIO.github.io/supplychain360/`. Tarda un par de
minutos en aparecer la primera vez.

Límites: 100 GB de ancho de banda al mes (límite *suave*), sitio publicado hasta
1 GB, 10 publicaciones por hora. Una tarea escolar no se acerca ni de lejos.
Uso comercial prohibido; una tarea no lo es.

## Respaldo: Cloudflare Pages

Si GitHub Pages falla. Las peticiones a archivos estáticos son gratuitas e
ilimitadas y no hay restricción de uso no comercial.

```bash
npx wrangler login
npx wrangler pages project create
npx wrangler pages deploy .
```

Queda en `https://PROYECTO.pages.dev`. Ojo: un proyecto creado por subida directa
ya no se puede conectar a Git después.

## Si urge publicar en dos minutos

Arrastrar la carpeta a **vercel.com/drop**. Sin terminal ni Git, aunque sí pide
cuenta. El plan Hobby es solo para uso personal no comercial —una tarea escolar
cumple—, pero si se exceden los límites el recurso queda pausado 30 días.

## Lo que conviene evitar

**Netlify.** Su plan gratuito cambió a 300 créditos mensuales con límite duro, y
cada publicación a producción cuesta 15 créditos: unas 20 publicaciones al mes.
Peor: el camino «sin cuenta» de Netlify Drop **borra el sitio en una hora** si no
se reclama. Para una entrega que debe seguir viva cuando el profesor la revise,
es un riesgo innecesario.

**Constructores visuales tipo Carrd.** En su plan gratuito no permiten insertar
código propio —eso es función de pago—, así que no admiten el JavaScript ni los
JSON del proyecto.

## Antes de entregar la URL

1. Ábrela en una ventana de incógnito: confirma que carga sin iniciar sesión.
2. Ábrela en el celular.
3. Navega los módulos y comprueba que los datos aparecen —si los JSON no
   cargan, casi siempre es una ruta con mayúsculas distintas: GitHub Pages
   distingue mayúsculas y minúsculas, Windows no.
4. Haz tres preguntas al bot.
5. Comparte el avance en el canal de la materia (instrucción 5) y sube la URL
   final en la plataforma (instrucción 6). **Son pasos distintos: la calificación
   depende del segundo.**
