// Forma website builder: form handling, preview generation, autosave, and export.

// Keep page elements and form field names in one place so the rest of the
// application can work with a single website brief object.
const form = document.querySelector('#form');
const generateButton = document.querySelector('#generate');
const viewport = document.querySelector('#viewport');
const fields = ['name', 'description', 'goal', 'requirements', 'tagline', 'email', 'audience', 'offerings', 'location', 'phone', 'social', 'kind', 'style'];
let accent = '#d7f46a';
let generatedHtml = '';
let logoImage = null;
let siteImages = [];

// User-entered text is escaped before it is written into generated HTML.
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

function readBrief() {
  return Object.fromEntries(fields.map((id) => [id, document.getElementById(id).value.trim()]));
}

// Save ordinary text and selection values so a refresh does not lose the brief.
function saveDraft() {
  try {
    localStorage.setItem('forma-draft', JSON.stringify({ ...readBrief(), accent }));
  } catch (error) {
    // The app still works when storage is disabled or unavailable.
  }
}

function restoreDraft() {
  try {
    const draft = JSON.parse(localStorage.getItem('forma-draft') || 'null');
    if (!draft) return;
    fields.forEach((id) => {
      if (draft[id] !== undefined) document.getElementById(id).value = draft[id];
    });
    if (draft.accent) accent = draft.accent;
    document.querySelectorAll('.swatch').forEach((swatch) => {
      const selected = swatch.dataset.color === accent;
      swatch.classList.toggle('active', selected);
      if (selected) swatch.setAttribute('aria-pressed', 'true');
    });
  } catch (error) {
    localStorage.removeItem('forma-draft');
  }
}

// Resize selected images and convert them to data URLs. The generated HTML can
// then include the images directly, so the download does not need separate files.
async function optimizeImage(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Please choose a PNG, JPG, or WebP image.');
  if (file.size > 12 * 1024 * 1024) throw new Error(`${file.name} is larger than 12 MB.`);
  if (!window.createImageBitmap) {
    const source = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
      reader.readAsDataURL(file);
    });
    return { name: file.name, src: source };
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / bitmap.width, 1200 / bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  return { name: file.name, src: canvas.toDataURL(outputType, 0.84) };
}

function renderUploads(targetId, images, onRemove) {
  const target = document.getElementById(targetId);
  target.replaceChildren();
  images.forEach((image, index) => {
    const item = document.createElement('div');
    item.className = 'upload-thumb';
    const preview = document.createElement('img');
    preview.src = image.src;
    preview.alt = image.name;
    const caption = document.createElement('span');
    caption.textContent = image.name;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove-upload';
    remove.setAttribute('aria-label', `Remove ${image.name}`);
    remove.textContent = '×';
    remove.addEventListener('click', () => onRemove(index));
    item.append(preview, caption, remove);
    target.append(item);
  });
}

// Image upload controls support both the file picker and drag-and-drop.
function renderPhotoUploads() {
  renderUploads('photoPreview', siteImages, (index) => {
    siteImages.splice(index, 1);
    document.querySelector('#photoUpload').value = '';
    renderPhotoUploads();
  });
}

document.querySelector('#logoUpload').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    logoImage = await optimizeImage(file);
    renderUploads('logoPreview', [logoImage], () => {
      logoImage = null;
      event.target.value = '';
      renderUploads('logoPreview', [], () => {});
    });
    notify('Logo added. It will appear in the generated website.');
  } catch (error) { notify(error.message); }
});

document.querySelector('#photoUpload').addEventListener('change', async (event) => {
  const files = Array.from(event.target.files);
  if (files.length > 4) notify('Choose up to four photos. The first becomes the main image.');
  try {
    siteImages = await Promise.all(files.slice(0, 4).map(optimizeImage));
    renderPhotoUploads();
    if (siteImages.length) notify(`${siteImages.length} photo${siteImages.length === 1 ? '' : 's'} added to your website.`);
  } catch (error) { notify(error.message); }
});

document.querySelectorAll('.upload-box').forEach((box) => {
  box.addEventListener('dragover', (event) => { event.preventDefault(); box.classList.add('dragging'); });
  box.addEventListener('dragleave', () => box.classList.remove('dragging'));
  box.addEventListener('drop', (event) => {
    event.preventDefault();
    box.classList.remove('dragging');
    const input = document.getElementById(box.htmlFor);
    if (event.dataTransfer.files.length) {
      input.files = event.dataTransfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
});

// Build the finished, standalone website from the brief and any uploaded images.
function makeWebsite(
  {
    name,
    description,
    goal,
    requirements,
    tagline,
    email,
    audience,
    offerings,
    location,
    phone,
    social,
    kind,
    style
  },
  logo,
  photos
) {
  const headline = description.length > 76
    ? `${description.slice(0, 73).replace(/\s+\S*$/, '')}…`
    : description;
  const titleFont = ['Editorial', 'Luxe'].includes(style) ? 'Playfair Display' : 'DM Sans';
  const darkMode = style === 'Bold';
  const pageBg = darkMode ? '#171b19' : '#f8f7f3';
  const pageText = darkMode ? '#f5f4ee' : '#202720';
  const accentText = '#1c2723';
  const defaultCta = kind === 'Restaurant / café' ? 'Book a table'
    : kind === 'Online store' ? 'Shop the collection'
    : kind === 'Portfolio' ? 'View selected work'
    : kind === 'Event' ? 'Save your place' : 'Get in touch';
  const cta = goal && goal !== 'Get in touch' ? goal : defaultCta;
  const stockImage = kind === 'Restaurant / café'
    ? 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1300&q=85'
    : kind === 'Portfolio'
      ? 'https://images.unsplash.com/photo-1531058020387-3be344556be6?auto=format&fit=crop&w=1300&q=85'
      : kind === 'Online store'
        ? 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1300&q=85'
        : 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1300&q=85';
  const safeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : 'hello@example.com';
  const taglineText = tagline || 'A little more thoughtful, every day';
  const introText = escapeHtml(description);
  const image = photos[0]?.src || stockImage;
  const logoMarkup = logo
    ? `<img class="logo-image" src="${logo.src}" alt="${escapeHtml(name)} logo">`
    : escapeHtml(name);

  const galleryMarkup = photos.length > 1
    ? `
      <section class="band photo-gallery">
        <div class="kicker">A closer look</div>
        <h2>See it for yourself.</h2>
        <div class="gallery-grid">
          ${photos.slice(1, 4).map((photo) => `
            <img src="${photo.src}" alt="${escapeHtml(photo.name)}">
          `).join('')}
        </div>
      </section>
    `
    : '';

  const requirementsMarkup = requirements
    ? `
      <section class="band details-band">
        <div class="kicker">Good to know</div>
        <h2>Here's what to expect.</h2>
        <p>${escapeHtml(requirements).replace(/\n/g, '<br>')}</p>
      </section>
    `
    : '';
  const serviceItems = (offerings || '').split(/[,\n]/).map((item) => item.trim()).filter(Boolean).slice(0, 3);
  const defaultServices = ['Made with intention', 'A personal touch', 'Here for the long run'];
  const defaultDescriptions = [
    'Every detail has a purpose, and every experience feels considered from the very start.',
    'Good things happen when we take the time to understand what matters to you.',
    'Quality, care, and a little extra thought in everything we do.'
  ];
  const serviceCards = (serviceItems.length ? serviceItems : defaultServices)
    .map((item, index) => {
      const cardDescription = serviceItems.length
        ? `Discover how ${escapeHtml(item.toLowerCase())} can make a difference.`
        : defaultDescriptions[index];

      return `
        <article class="card">
          <b>${escapeHtml(item)}</b>
          <p>${cardDescription}</p>
        </article>
      `;
    })
    .join('');
  const safeSocial = (() => {
    try {
      const parsed = new URL(social);
      return ['https:', 'http:'].includes(parsed.protocol) ? parsed.href : '';
    } catch (error) {
      return '';
    }
  })();
  const contactDetails = [
    location ? `<span>${escapeHtml(location)}</span>` : '',
    phone ? `<a href="tel:${escapeHtml(phone.replace(/[^+\d]/g, ''))}">${escapeHtml(phone)}</a>` : '',
    safeSocial ? `<a href="${escapeHtml(safeSocial)}" target="_blank" rel="noopener noreferrer">Follow along ↗</a>` : ''
  ].filter(Boolean).join('<span class="separator">·</span>');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escapeHtml(description.slice(0, 155))}">
  <title>${escapeHtml(name)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@500;600;700&display=swap" rel="stylesheet">
  <!-- Generated styles are included in the downloaded page. -->
  <style>
* {
  box-sizing: border-box;
}

html { scroll-behavior: smooth; }
body {
  margin: 0;
  background: ${pageBg};
  color: ${pageText};
  font-family: 'DM Sans', sans-serif;
}
a { transition: opacity .2s; }
a:hover { opacity: .72; }

header {
  height: 78px;
  padding: 0 7%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid ${darkMode ? '#343735' : '#e9e8e1'};
}
.logo { font-weight: 700; letter-spacing: -.04em; font-size: 19px; }
.logo-image { max-width: 145px; max-height: 44px; object-fit: contain; }
.nav { display: flex; gap: 26px; align-items: center; font-size: 11px; }
.nav a { color: inherit; text-decoration: none; }
.button {
  background: ${accent};
  border-radius: 3px;
  padding: 12px 18px;
  color: ${accentText} !important;
  font-weight: 600;
}

.hero {
  max-width: 1160px;
  margin: auto;
  padding: 78px 7% 85px;
  display: grid;
  grid-template-columns: 1.03fr .97fr;
  gap: 60px;
  align-items: center;
}
.kicker {
  text-transform: uppercase;
  letter-spacing: .16em;
  font-size: 9px;
  font-weight: 600;
  color: ${darkMode ? accent : '#737b70'};
}
h1 {
  font-family: '${titleFont}', sans-serif;
  font-size: clamp(42px, 5.6vw, 72px);
  line-height: 1.02;
  letter-spacing: -.055em;
  font-weight: ${titleFont === 'Playfair Display' ? 500 : 600};
  margin: 18px 0 19px;
  max-width: 570px;
}
.intro {
  font-size: 14px;
  line-height: 1.8;
  color: ${darkMode ? '#c1c4be' : '#666e66'};
  max-width: 410px;
}
.cta {
  display: inline-block;
  margin-top: 22px;
  background: ${accent};
  color: ${accentText};
  text-decoration: none;
  padding: 15px 21px;
  border-radius: 3px;
  font-weight: 600;
  font-size: 11px;
}
.photo { height: 460px; position: relative; background: #ddd; overflow: hidden; }
.photo img { width: 100%; height: 100%; object-fit: cover; }
.note {
  position: absolute;
  right: 12px;
  bottom: 20px;
  background: ${pageBg};
  padding: 17px 20px;
  font-size: 10px;
  letter-spacing: .06em;
  text-transform: uppercase;
}

.band {
  background: ${darkMode ? '#242925' : '#ebece5'};
  padding: 65px 7%;
  text-align: center;
}
.band h2 { font: 500 34px 'Playfair Display', serif; margin: 12px auto; max-width: 650px; line-height: 1.2; }
.band p { font-size: 12px; color: ${darkMode ? '#c1c4be' : '#71786f'}; line-height: 1.8; max-width: 570px; margin: 15px auto; }
.audience { font-size: 11px !important; margin-top: 22px !important; }
.cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; max-width: 1050px; margin: 35px auto 0; text-align: left; }
.card { padding: 23px; background: ${pageBg}; min-height: 130px; }
.card b { display: block; font-size: 12px; margin-bottom: 10px; }
.card p { margin: 0; font-size: 11px; }
.contact-band { background: ${pageBg} !important; }
.contact-details { display: flex; justify-content: center; gap: 10px; align-items: center; flex-wrap: wrap; margin: 22px auto; font-size: 11px; }
.contact-details a { color: inherit; }
.separator { color: #a7aaa3; }
footer { padding: 30px 7%; font-size: 10px; color: #838981; display: flex; justify-content: space-between; align-items: center; gap: 18px; flex-wrap: wrap; }
.footer-links { display: flex; gap: 18px; flex-wrap: wrap; }
.footer-links a { color: inherit; text-decoration: none; }
.gallery-grid { max-width: 1050px; margin: 30px auto 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
.gallery-grid img { width: 100%; height: 220px; object-fit: cover; border-radius: 3px; }
.details-band { background: ${pageBg} !important; }
.details-band p { white-space: normal; }

@media (max-width: 700px) {
  .nav a:not(.button) { display: none; }
  .hero { grid-template-columns: 1fr; padding-top: 52px; gap: 35px; }
  .photo { height: 320px; }
  .cards { grid-template-columns: 1fr; }
  .band { padding: 48px 7%; }
}
</style>
</head>
<body>
  <header>
    <div class="logo">${logoMarkup}</div>
    <nav class="nav" aria-label="Main navigation">
      <a href="#about">About</a>
      <a href="#offerings">What we do</a>
      <a href="#contact" class="button">${cta} ↗</a>
    </nav>
  </header>

  <main>
    <section class="hero">
      <div>
        <div class="kicker">${escapeHtml(kind)} · Made with care</div>
        <h1>${escapeHtml(headline)}</h1>
        <p class="intro">${introText}</p>
        <a class="cta" href="#contact">${cta} &nbsp; ↗</a>
      </div>
      <div class="photo">
        <img src="${image}" alt="A glimpse into ${escapeHtml(name)}">
        <div class="note">${escapeHtml(taglineText)}</div>
      </div>
    </section>

    <section class="band" id="about">
      <div class="kicker">A good place to begin</div>
      <h2>Thoughtful by nature. Made for you.</h2>
      <p>${introText}</p>
      ${audience ? `<p class="audience"><strong>Made for:</strong> ${escapeHtml(audience)}</p>` : ''}
      <div class="cards" id="offerings">
        ${serviceCards}
      </div>
    </section>
    ${galleryMarkup}
    ${requirementsMarkup}

    <section class="band contact-band" id="contact">
      <div class="kicker">Let's make it happen</div>
      <h2>We'd love to hear from you.</h2>
      <p>Tell us what you're looking for and we'll take it from here.</p>
      <div class="contact-details">${contactDetails}</div>
      <a class="cta" href="mailto:${safeEmail}">${cta} &nbsp; ↗</a>
    </section>
  </main>

  <footer>
    <span>© ${new Date().getFullYear()} ${escapeHtml(name)}</span>
    <nav class="footer-links" aria-label="Footer links">
      <a href="#about">About</a>
      <a href="#offerings">Offerings</a>
      <a href="#contact">Contact</a>
      <a href="mailto:${safeEmail}">Email us</a>
    </nav>
    <span>Made with care · All rights reserved</span>
  </footer>
</body>
</html>`;

}

// Preview the generated website inside the builder without navigating away.
function showPreview() {
  const frame = viewport.querySelector('iframe') || document.createElement('iframe');
  frame.className = 'placeholder';
  frame.title = 'Generated website live preview';
  frame.setAttribute('sandbox', 'allow-scripts allow-forms allow-popups allow-same-origin');
  viewport.replaceChildren(frame);
  frame.srcdoc = generatedHtml;
  document.querySelector('#dot').classList.add('ready');
  document.querySelector('#status').textContent = 'YOUR WEBSITE IS READY';
  document.querySelector('#dimensions').textContent = 'LIVE PREVIEW · RESPONSIVE';
}

// Form behavior: autosave, color choices, device preview, and template examples.
form.addEventListener('input', saveDraft);
form.addEventListener('change', saveDraft);

document.querySelectorAll('.swatch').forEach((swatch) => {
  swatch.addEventListener('click', () => {
    document.querySelectorAll('.swatch').forEach((item) => {
      item.classList.remove('active');
      item.setAttribute('aria-pressed', 'false');
    });
    swatch.classList.add('active');
    swatch.setAttribute('aria-pressed', 'true');
    accent = swatch.dataset.color;
    saveDraft();
  });
});

document.querySelectorAll('.device').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.device').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    viewport.style.setProperty('--preview-width', button.dataset.width);
    document.querySelector('#dimensions').textContent = `${button.textContent.toUpperCase()} PREVIEW`;
  });
});

document.querySelectorAll('.example-card').forEach((card) => {
  card.addEventListener('click', () => {
    document.querySelector('#kind').value = card.dataset.kind;
    document.querySelector('#style').value = card.dataset.style;
    saveDraft();
    document.querySelector('#creator').scrollIntoView({ behavior: 'smooth' });
    notify(`${card.dataset.kind} style selected. Add your details below.`);
  });
});

// Generate, preview, and download actions.
form.addEventListener('submit', (event) => {
  event.preventDefault();
  generateButton.disabled = true;
  generateButton.innerHTML = '<span>✦</span> Creating your website…';
  document.querySelector('#status').textContent = 'BUILDING YOUR WEBSITE';
  window.setTimeout(() => {
    generatedHtml = makeWebsite(readBrief(), logoImage, siteImages);
    showPreview();
    generateButton.disabled = false;
    generateButton.innerHTML = '<span>✦</span> Update my website <span class="arrow">↗</span>';
    notify('Your website is ready to preview and download.');
  }, 350);
});

document.querySelector('#refresh').addEventListener('click', () => {
  if (!generatedHtml) return notify('Add your details to create a preview.');
  showPreview();
});

document.querySelector('#download').addEventListener('click', () => {
  if (!generatedHtml) return notify('Create your website first, then download it.');
  const filename = (readBrief().name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'my-website') + '.html';
  const file = new Blob([generatedHtml], { type: 'text/html' });
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  notify('Your website file has been downloaded.');
});

function notify(message) {
  const toast = document.querySelector('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 2600);
}

restoreDraft();
