const $ = (sel) => document.querySelector(sel);
const API = "https://pokeapi.co/api/v2";


const input = $("#query");
const searchBtn = $("#searchBtn");
const randomBtn = $("#randomBtn");
const card = $("#card");
const errBox = $("#error");
const art = $("#art");
const nameEl = $("#name");
const idEl = $("#id");
const typesEl = $("#types");
const heightEl = $("#height");
const weightEl = $("#weight");
const basexpEl = $("#basexp");
const abilitiesEl = $("#abilities");
const statsEl = $("#stats");
const weakEl = $("#weak");
const resistEl = $("#resist");
const immuneEl = $("#immune");
const evoEl = $("#evo");

searchBtn.addEventListener("click", () => go(input.value.trim()));
randomBtn.addEventListener("click", async () => {
  // As of Gen 9: 1010+; cap at 1025 to be safe
  const randomId = Math.floor(Math.random() * 1025) + 1;
  go(String(randomId));
});
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") go(input.value.trim());
});

// Entry
async function go(q) {
  clearError();
  if (!q) return showError("Please enter a Pokémon name or ID.");
  try {
    const data = await fetchPokemon(q.toLowerCase());
    await renderPokemon(data);
  } catch (e) {
    console.error(e);
    showError("Pokémon not found. Try names like <b>pikachu</b>, <b>charizard</b>, or an ID like <b>25</b>.");
  }
}

function showError(html) {
  errBox.innerHTML = html;
  errBox.classList.remove("hidden");
  card.classList.add("hidden");
}
function clearError() {
  errBox.classList.add("hidden");
  errBox.innerHTML = "";
}

// Fetch core Pokémon data
async function fetchPokemon(q) {
  const res = await fetch(`${API}/pokemon/${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error("Not found");
  return res.json();
}

// Render everything
async function renderPokemon(p) {
  // Top summary
  nameEl.textContent = cap(p.name);
  idEl.textContent = `#${p.id}`;
  art.src = getArtwork(p);
  art.alt = p.name;

  typesEl.innerHTML = "";
  p.types
    .sort((a,b)=>a.slot-b.slot)
    .forEach(t => typesEl.appendChild(typeBadge(t.type.name)));

  heightEl.textContent = `${(p.height / 10).toFixed(1)} m`;
  weightEl.textContent = `${(p.weight / 10).toFixed(1)} kg`;
  basexpEl.textContent = p.base_experience ?? "—";

  // Abilities
  abilitiesEl.innerHTML = "";
  p.abilities
    .sort((a,b) => Number(a.is_hidden) - Number(b.is_hidden))
    .forEach(a => {
      const li = document.createElement("li");
      li.textContent = a.ability.name.replace(/-/g, " ") + (a.is_hidden ? " (hidden)" : "");
      abilitiesEl.appendChild(li);
    });

  // Stats with bars
  statsEl.innerHTML = "";
  p.stats.forEach(s => {
    const row = document.createElement("div");
    row.className = "stat";
    const label = document.createElement("div");
    label.className = "label";
    label.textContent = statLabel(s.stat.name);
    const bar = document.createElement("div");
    bar.className = "bar";
    const span = document.createElement("span");
    const pct = Math.min(100, Math.round((s.base_stat / 200) * 100));
    requestAnimationFrame(() => (span.style.width = pct + "%"));
    bar.appendChild(span);
    const value = document.createElement("div");
    value.className = "value";
    value.textContent = s.base_stat;

    row.append(label, bar, value);
    statsEl.appendChild(row);
  });

  // Type matchups
  await renderMatchups(p.types.map(t => t.type.name));

  // Evolution chain
  await renderEvolutionChain(p.species?.url);

  card.classList.remove("hidden");
}

// Helpers
function cap(s){ return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, " "); }
function statLabel(s){
  const map = { "hp":"HP", "attack":"ATK", "defense":"DEF", "special-attack":"SpA", "special-defense":"SpD", "speed":"SPD" };
  return map[s] || cap(s);
}
function getArtwork(p){
  const a = p.sprites.other?.["official-artwork"]?.front_default;
  const d = p.sprites.front_default;
  return a || d || "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/0.png";
}
function typeBadge(type){
  const span = document.createElement("span");
  span.className = "type-badge";
  span.dataset.type = type;
  span.textContent = type;
  return span;
}

async function renderMatchups(types){
  const typeNames = await getAllTypeNames();
  const mult = Object.fromEntries(typeNames.map(t => [t, 1]));

  for (const t of types){
    const rel = await fetchTypeRelations(t);
    rel.double_damage_from.forEach(x => mult[x] *= 2);
    rel.half_damage_from.forEach(x => mult[x] *= 0.5);
    rel.no_damage_from.forEach(x => mult[x] *= 0);
  }

  const weak = [], resist = [], immune = [];
  for (const [atk, m] of Object.entries(mult)){
    if (m === 0) immune.push(atk);
    else if (m > 1) weak.push(`${atk}${m>=4?" (4×)":" (2×)"}`);
    else if (m < 1) resist.push(`${atk}${m<=0.25?" (¼×)":" (½×)"}`);
  }

  weakEl.innerHTML = "";
  resistEl.innerHTML = "";
  immuneEl.innerHTML = "";

  weak.forEach(t => weakEl.appendChild(typeBadge(t.replace(/\s*\(.+\)$/, "")).appendChild(document.createTextNode("")) || typeBadge(t)));
  // To show the multiplier in title
  enhanceWithTitles(weakEl, weak);

  resist.forEach(t => resistEl.appendChild(typeBadge(t.replace(/\s*\(.+\)$/, ""))));
  enhanceWithTitles(resistEl, resist);

  immune.forEach(t => immuneEl.appendChild(typeBadge(t)));
}

function enhanceWithTitles(container, arr){
  const kids = [...container.children];
  kids.forEach((el, i) => el.title = arr[i]);
}

const typeCache = new Map();
async function fetchTypeRelations(typeName){
  if (typeCache.has(typeName)) return typeCache.get(typeName);
  const res = await fetch(`${API}/type/${typeName}`);
  if (!res.ok) throw new Error("Type fetch failed");
  const data = await res.json();
  const rel = {
    double_damage_from: data.damage_relations.double_damage_from.map(x=>x.name),
    half_damage_from: data.damage_relations.half_damage_from.map(x=>x.name),
    no_damage_from: data.damage_relations.no_damage_from.map(x=>x.name),
  };
  typeCache.set(typeName, rel);
  return rel;
}

let allTypeNames = null;
async function getAllTypeNames(){
  if (allTypeNames) return allTypeNames;
  const res = await fetch(`${API}/type`);
  const data = await res.json();
  // Filter out "shadow" and "unknown" if present
  allTypeNames = data.results.map(r=>r.name).filter(n => !["shadow","unknown"].includes(n));
  return allTypeNames;
}

// Evolution chain rendering
async function renderEvolutionChain(speciesUrl){
  evoEl.innerHTML = "";
  if (!speciesUrl) return;

  try{
    const species = await (await fetch(speciesUrl)).json();
    if (!species.evolution_chain?.url) return;
    const chain = await (await fetch(species.evolution_chain.url)).json();

    const evoNodes = flattenChain(chain.chain);
    for (let i=0; i<evoNodes.length; i++){
      const name = evoNodes[i].species_name;
      const id = await getIdFromSpecies(name);
      const block = document.createElement("div");
      block.className = "evo";
      const img = document.createElement("img");
      img.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
      img.alt = name;
      const label = document.createElement("div");
      label.className = "evoname";
      label.textContent = cap(name);
      block.append(img, label);
      evoEl.appendChild(block);

      if (i < evoNodes.length - 1){
        const arrow = document.createElement("div");
        arrow.className = "arrow";
        arrow.textContent = "➜";
        evoEl.appendChild(arrow);
      }
    }
  } catch(e){
    console.warn("Evolution chain fetch failed", e);
  }
}

function flattenChain(node){
  const out = [];
  function walk(n){
    out.push({ species_name: n.species.name });
    // If multiple branches exist, pick first for simplicity; could render all branches if desired
    if (n.evolves_to && n.evolves_to.length){
      n.evolves_to.forEach((child, idx) => {
        if (idx === 0) walk(child); // primary path
      });
    }
  }
  walk(node);
  return out;
}

const speciesIdCache = new Map();
async function getIdFromSpecies(name){
  if (speciesIdCache.has(name)) return speciesIdCache.get(name);
  const res = await fetch(`${API}/pokemon/${name}`);
  if (!res.ok) return null;
  const data = await res.json();
  speciesIdCache.set(name, data.id);
  return data.id;
}


go("pikachu");