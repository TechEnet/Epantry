import {
  ArrowLeft,
  ArrowRight,
  Clock3,
  LoaderCircle,
  RotateCcw,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { generateAiCook } from "../services/recipe.service";

const LANDING_COOK_QUERY_KEY = "epantry-cook-today-landing-input";

// Page-scoped design. No global theme or shared workspace styles are changed.
const COOK_STUDIO_CSS = String.raw`
  .ct-page {
    --ct-porcelain: #F7F6F2;
    --ct-forest: #173F35;
    --ct-charcoal: #202421;
    --ct-sage: #D7DDCF;
    --ct-clay: #C56C42;
    --ct-muted: #5A655F;
    background: var(--ct-porcelain);
    color: var(--ct-charcoal);
    font-family: 'Plus Jakarta Sans', Inter, ui-sans-serif, system-ui, sans-serif;
    min-width: 0;
    width: 100%;
    overflow-x: clip;
  }
  .ct-page * { box-sizing: border-box; }
  .ct-wrap { width: 100%; padding: 0 clamp(16px, 2.7vw, 48px) clamp(28px, 3vw, 44px); }
  .ct-back { display: flex; align-items: center; min-height: 54px; }
  .ct-back a { display: inline-flex; align-items: center; gap: 8px; color: var(--ct-forest); font-weight: 650; font-size: 14px; text-decoration: none; }
  .ct-back a:hover { text-decoration: underline; text-underline-offset: 4px; }
  .ct-page button:focus-visible, .ct-page a:focus-visible, .ct-page textarea:focus-visible {
    outline: 3px solid var(--ct-clay); outline-offset: 3px;
  }
  .ct-hero { display: grid; grid-template-columns: minmax(0, 0.94fr) minmax(0, 1.06fr); min-height: min(720px, calc(100svh - 214px)); background: var(--ct-sage); }
  .ct-story { position: relative; display: flex; flex-direction: column; justify-content: space-between; min-width: 0; background: var(--ct-forest); color: var(--ct-porcelain); padding: clamp(32px, 4.1vw, 72px); overflow: hidden; }
  .ct-story:before { content: ''; position: absolute; top: 0; right: 0; width: 12px; height: 100%; background: var(--ct-clay); opacity: .94; }
  .ct-eyebrow { display: flex; align-items: center; gap: 11px; color: var(--ct-forest); font-size: 12px; line-height: 1.45; font-weight: 750; text-transform: uppercase; letter-spacing: .10em; }
  .ct-eyebrow:before { content: ''; flex: 0 0 23px; height: 2px; background: var(--ct-clay); }
  .ct-eyebrow-light { color: var(--ct-sage); }
  .ct-story h1 { margin: clamp(32px, 6vh, 72px) 0 20px; max-width: 760px; font-size: clamp(38px, 3.7vw, 61px); line-height: 1.09; letter-spacing: -.055em; font-weight: 650; }
  .ct-story h1 em { font-style: normal; color: var(--ct-sage); }
  .ct-copy-mobile { display: none; }
  .ct-story-lede { max-width: 520px; font-size: clamp(15px, 1.15vw, 18px); line-height: 1.7; color: #E1E7DC; }
  .ct-journey { margin-top: 45px; padding-top: 23px; border-top: 1px solid rgba(247,246,242,.27); }
  .ct-journey-title { font-size: 12px; letter-spacing: .09em; font-weight: 700; text-transform: uppercase; color: var(--ct-sage); }
  .ct-journey-steps { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); margin-top: 22px; gap: clamp(10px,1.9vw,28px); }
  .ct-journey-step { min-width: 0; }
  .ct-journey-step-num { display: block; padding-bottom: 12px; font-weight: 750; font-size: 18px; color: #E6B297; border-bottom: 2px solid rgba(247,246,242,.28); }
  .ct-journey-step:first-child .ct-journey-step-num { border-color: var(--ct-clay); }
  .ct-journey-step strong { display: block; margin-top: 12px; color: var(--ct-porcelain); font-size: 14px; font-weight: 650; line-height: 1.45; }
  .ct-journey-step span:last-child { display: block; margin-top: 7px; color: #C6D2C8; font-size: 12px; line-height: 1.55; }
  .ct-editor { display: flex; flex-direction: column; justify-content: center; min-width: 0; padding: clamp(30px,4vw,65px); }
  .ct-editor-main { width: 100%; max-width: 730px; margin-inline: auto; }
  .ct-editor h2 { font-size: clamp(28px,2.6vw,40px); line-height: 1.15; letter-spacing: -.045em; font-weight: 680; color: var(--ct-forest); margin: 17px 0 12px; }
  .ct-editor-sub { color: #44544B; font-size: 16px; line-height: 1.6; max-width: 540px; }
  .ct-editor-form { margin-top: clamp(20px,3vh,34px); }
  .ct-field-label { display: block; color: var(--ct-charcoal); font-size: 15px; font-weight: 700; margin-top: 25px; margin-bottom: 11px; }
  .ct-textarea { display: block; width: 100%; min-height: clamp(172px, 21vh, 244px); resize: vertical; border-radius: 0; border: 1px solid #ABB5A9; border-left: 4px solid var(--ct-clay); background: var(--ct-porcelain); font: inherit; font-size: 16px; line-height: 1.7; padding: 20px; color: var(--ct-charcoal); transition: border-color .2s, box-shadow .2s; }
  .ct-textarea:focus { border-color: var(--ct-forest); box-shadow: 0 0 0 3px rgba(23,63,53,.10); outline: none; }
  .ct-textarea::placeholder { color: #707C74; opacity: 1; }
  .ct-examples { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin: 15px 0 0; }
  .ct-examples-label { margin-right: 5px; font-size: 13px; font-weight: 650; color: #48564D; }
  .ct-example { border: 1px solid #ADB9AA; background: rgba(247,246,242,.50); padding: 8px 11px; color: var(--ct-forest); font: inherit; font-size: 13px; font-weight: 650; line-height: 1.35; cursor: pointer; transition: background .18s, border-color .18s; }
  .ct-example:hover { background: var(--ct-porcelain); border-color: var(--ct-forest); }
  .ct-submit { display: flex; width: 100%; align-items: center; justify-content: space-between; gap: 15px; margin-top: 23px; min-height: 59px; padding: 14px 20px; background: var(--ct-forest); border: 1px solid var(--ct-forest); color: #fff; font: inherit; font-size: 16px; font-weight: 720; cursor: pointer; text-align: left; transition: background .18s; }
  .ct-submit:hover:not(:disabled) { background: #245B4D; }
  .ct-submit:disabled { opacity: .65; cursor: wait; }
  .ct-submit-icon { display: inline-flex; align-items: center; justify-content: center; width: 33px; height: 33px; flex: 0 0 33px; background: rgba(255,255,255,.11); }
  .ct-safety { display: flex; align-items: flex-start; gap: 10px; margin-top: 20px; padding-top: 15px; border-top: 1px solid #B6C0B1; font-size: 13px; line-height: 1.6; color: #526056; }
  .ct-safety:before { content: ''; height: 7px; width: 7px; border-radius: 50%; background: var(--ct-clay); margin-top: 7px; flex: 0 0 7px; }
  .ct-error { margin-top: 14px; padding: 12px 15px; border-left: 3px solid var(--ct-clay); background: #F7F6F2; color: #782E20; font-size: 15px; line-height: 1.6; }
  .ct-handoff { margin-top: 24px; background: var(--ct-porcelain); border-left: 4px solid var(--ct-clay); padding: 24px; color: var(--ct-charcoal); font-size: 19px; font-weight: 650; line-height: 1.5; overflow-wrap: anywhere; }
  .ct-status { display: flex; align-items: center; gap: 12px; margin-top: 20px; color: var(--ct-forest); font-weight: 680; font-size: 15px; }
  .ct-handoff-note { margin-top: 16px; color: #4C5B50; font-size: 15px; line-height: 1.55; }
  .ct-loading { margin-top: 28px; display: flex; align-items: center; gap: 18px; padding: 24px; background: var(--ct-sage); color: var(--ct-forest); }
  .ct-loading h2 { font-size: 21px; font-weight: 700; }
  .ct-loading p { margin-top: 5px; font-size: 15px; color: #4B5A50; }
  .ct-results { margin-top: 35px; }
  .ct-result-header { display: flex; justify-content: space-between; align-items: end; flex-wrap: wrap; gap: 18px; margin-bottom: 20px; border-bottom: 1px solid #B8C0B5; padding-bottom: 20px; }
  .ct-result-header h2 { margin-top: 10px; font-size: clamp(29px,2.8vw,43px); line-height: 1.17; letter-spacing: -.04em; color: var(--ct-charcoal); font-weight: 690; }
  .ct-result-header p { max-width: 340px; font-size: 15px; line-height: 1.5; color: var(--ct-muted); }
  .ct-ideas { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 16px; }
  .ct-idea { min-width: 0; display: flex; flex-direction: column; justify-content: space-between; text-align: left; padding: clamp(19px,2vw,30px); background: var(--ct-porcelain); border: 1px solid #C8CEC2; border-top: 4px solid var(--ct-forest); color: var(--ct-charcoal); cursor: pointer; font: inherit; transition: transform .18s, border-color .18s, background .18s; }
  .ct-idea:nth-child(3n + 2) { border-top-color: var(--ct-clay); background: #F0F0E9; }
  .ct-idea:hover:not(:disabled) { transform: translateY(-3px); border-color: var(--ct-forest); }
  .ct-idea:disabled { opacity: .6; cursor: wait; }
  .ct-idea-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding-bottom: 15px; border-bottom: 1px solid #CAD0C6; color: #56645B; font-size: 12px; font-weight: 750; letter-spacing: .07em; text-transform: uppercase; }
  .ct-idea h3 { font-size: clamp(21px,1.8vw,27px); font-weight: 700; line-height: 1.22; letter-spacing: -.04em; margin-top: 23px; }
  .ct-idea p { margin-top: 11px; font-size: 15px; color: #4E5B53; line-height: 1.6; }
  .ct-idea-use { margin-top: 20px; border-top: 1px solid #CAD0C6; padding-top: 16px; }
  .ct-idea-use strong { display: block; color: var(--ct-forest); font-size: 13px; }
  .ct-idea-use span { display: block; margin-top: 7px; font-size: 14px; line-height: 1.6; color: #4E5B53; }
  .ct-idea-bottom { display: flex; flex-direction: column; gap: 13px; padding-top: 17px; border-top: 1px solid #CAD0C6; margin-top: 24px; }
  .ct-idea-meta { display: flex; flex-wrap: wrap; gap: 11px; font-size: 13px; color: #57625B; }
  .ct-idea-cta { display: flex; justify-content: space-between; gap: 12px; color: var(--ct-forest); font-weight: 700; font-size: 15px; }
  .ct-recipe { margin-top: 30px; border: 1px solid #C4CCBF; }
  .ct-recipe-top { background: var(--ct-forest); color: var(--ct-porcelain); padding: clamp(25px,4vw,55px); }
  .ct-recipe-back { display: inline-flex; gap: 8px; align-items: center; color: var(--ct-porcelain); background: transparent; border: 0; font: inherit; font-size: 15px; font-weight: 650; cursor: pointer; }
  .ct-recipe-intro { display: grid; grid-template-columns: 1.3fr 1fr; align-items: end; gap: 40px; margin-top: 34px; }
  .ct-recipe h2 { margin-top: 15px; max-width: 760px; font-size: clamp(32px,4vw,58px); line-height: 1.13; letter-spacing: -.045em; font-weight: 660; }
  .ct-recipe-description { margin-top: 17px; max-width: 670px; font-size: 16px; line-height: 1.65; color: #E1E8DF; }
  .ct-recipe-metrics { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 15px; border-top: 1px solid rgba(255,255,255,.3); padding-top: 21px; }
  .ct-recipe-metrics dt { color: #D7DDCF; font-size: 13px; }
  .ct-recipe-metrics dd { margin-top: 5px; color: #fff; font-size: 16px; font-weight: 680; overflow-wrap: anywhere; }
  .ct-recipe-content { display: grid; grid-template-columns: minmax(0,.82fr) minmax(0,1.18fr); }
  .ct-recipe-ingredients { padding: clamp(23px,3.2vw,46px); background: var(--ct-sage); }
  .ct-recipe-method { padding: clamp(23px,3.2vw,46px); background: var(--ct-porcelain); }
  .ct-recipe h3 { font-size: clamp(24px,2.4vw,34px); letter-spacing: -.035em; font-weight: 680; margin-top: 12px; color: var(--ct-forest); }
  .ct-recipe-list { margin-top: 20px; border-top: 1px solid #ADBAA9; }
  .ct-ingredient { display: flex; gap: 14px; justify-content: space-between; padding: 16px 0; border-bottom: 1px solid #B6C0B1; }
  .ct-ingredient-name { color: var(--ct-charcoal); font-size: 15px; line-height: 1.5; font-weight: 680; }
  .ct-ingredient-note { margin-top: 4px; color: #5A655F; font-size: 13px; line-height: 1.5; }
  .ct-ingredient-amount { flex-shrink: 0; font-size: 14px; font-weight: 680; color: var(--ct-forest); text-align: right; }
  .ct-recipe-tip { margin-top: 26px; padding: 19px 20px; border-left: 3px solid var(--ct-clay); background: rgba(247,246,242,.72); }
  .ct-recipe-tip h4 { display: flex; align-items: center; gap: 8px; color: var(--ct-forest); font-size: 16px; font-weight: 700; }
  .ct-recipe-tip li { margin-top: 9px; font-size: 14px; line-height: 1.65; color: #45544B; }
  .ct-method-row { display: grid; grid-template-columns: 43px minmax(0,1fr); gap: 13px; padding: 19px 0; border-bottom: 1px solid #CAD0C6; }
  .ct-method-number { color: var(--ct-clay); font-size: 22px; font-weight: 700; }
  .ct-method-text { color: var(--ct-charcoal); font-size: 16px; line-height: 1.65; }
  .ct-method-time { display: flex; align-items: center; gap: 5px; margin-top: 7px; color: #59655C; font-size: 13px; }
  .ct-recipe-disclaimer { padding: 16px clamp(23px,3.2vw,46px); border-top: 1px solid #C5CEBF; background: var(--ct-porcelain); font-size: 13px; line-height: 1.65; color: #58635C; }
  @media (max-width: 1190px) { .ct-ideas { grid-template-columns: repeat(2,minmax(0,1fr)); } .ct-story h1 { font-size: clamp(36px,4.6vw,55px); } }
  @media (max-width: 940px) {
    .ct-hero { grid-template-columns: minmax(0,1fr); min-height: 0; }
    .ct-story { padding: 33px clamp(22px,4vw,45px); }
    .ct-story:before { top: auto; right: 0; bottom: 0; width: 100%; height: 5px; }
    .ct-story h1 { margin-top: 24px; font-size: clamp(34px,5vw,47px); max-width: 800px; }
    .ct-journey { margin-top: 24px; }
    .ct-editor { padding: 35px clamp(22px,4vw,45px); }
    .ct-editor-main { max-width: none; }
    .ct-recipe-intro { grid-template-columns: minmax(0,1fr); gap: 24px; }
  }
  @media (max-width: 650px) {
    /* Mobile only: keep the full studio width, without changing desktop. */
    .ct-wrap { padding-inline: 4px; padding-bottom: 16px; }
    .ct-back { min-height: 36px; padding-inline: 10px; }
    .ct-copy-desktop { display: none; }
    .ct-copy-mobile { display: inline; }
    .ct-story { padding: 18px 14px 16px; }
    .ct-story h1 { margin-top: 11px; margin-bottom: 8px; font-size: clamp(26px, 7.5vw, 33px); line-height: 1.14; letter-spacing: -.042em; }
    .ct-story-lede { font-size: 14px; line-height: 1.45; max-width: 100%; }
    .ct-journey { margin-top: 15px; padding-top: 11px; }
    .ct-journey-steps { gap: 8px; margin-top: 10px; }
    .ct-journey-step-num { font-size: 15px; padding-bottom: 6px; }
    .ct-journey-step strong { font-size: 12px; margin-top: 6px; }
    .ct-journey-step span:last-child { display: none; }
    .ct-editor { padding: 18px 14px 20px; }
    .ct-editor-form { margin-top: 0; }
    .ct-editor h2 { font-size: clamp(24px, 6.5vw, 28px); margin: 10px 0 8px; }
    .ct-editor-sub { font-size: 14px; line-height: 1.5; }
    .ct-field-label { margin-top: 14px; margin-bottom: 7px; }
    .ct-textarea { min-height: 140px; padding: 13px; }
    .ct-examples { margin-top: 11px; gap: 7px; }
    .ct-submit { margin-top: 16px; min-height: 51px; font-size: 14px; }
    .ct-safety { margin-top: 14px; padding-top: 11px; }
    .ct-ideas { grid-template-columns: minmax(0,1fr); }
    .ct-recipe-content { grid-template-columns: minmax(0,1fr); }
    .ct-recipe-top { padding: 23px; }
    .ct-recipe-metrics { gap: 10px; }
    .ct-recipe-metrics dd { font-size: 14px; }
    .ct-recipe-ingredients, .ct-recipe-method { padding: 24px 20px; }
  }
  @media (prefers-reduced-motion: reduce) { .ct-page * { transition: none !important; animation: none !important; } }
`;

function displayValue(value, fallback = "—") {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}

function SectionLabel({ number, children, light = false }) {
  return (
    <p className={`ct-eyebrow${light ? " ct-eyebrow-light" : ""}`}>
      {number ? `${number} / ` : null}
      {children}
    </p>
  );
}

function SuggestionCard({ suggestion, index, onSelect, loading }) {
  return (
    <button
      type="button"
      className="ct-idea"
      onClick={() => onSelect(suggestion)}
      disabled={loading}
    >
      <div>
        <div className="ct-idea-top">
          <span>Dish idea {String(index + 1).padStart(2, "0")}</span>
          <ArrowRight size={20} aria-hidden="true" />
        </div>
        <h3>{suggestion.name}</h3>
        <p>
          {displayValue(
            suggestion.whyItFits,
            "A practical idea based on the ingredients you entered."
          )}
        </p>
        {Array.isArray(suggestion.uses) && suggestion.uses.length > 0 ? (
          <div className="ct-idea-use">
            <strong>Uses what you have</strong>
            <span>{suggestion.uses.join(" · ")}</span>
          </div>
        ) : null}
      </div>
      <div className="ct-idea-bottom">
        <div className="ct-idea-meta">
          {suggestion.cuisine ? <span>{suggestion.cuisine}</span> : null}
          {suggestion.difficulty ? <span>{suggestion.difficulty}</span> : null}
          <span className="inline-flex items-center gap-1.5">
            <Clock3 size={14} aria-hidden="true" />
            {displayValue(suggestion.estimatedTime, "Time varies")}
          </span>
        </div>
        <span className="ct-idea-cta">
          See the full recipe <ArrowRight size={19} aria-hidden="true" />
        </span>
      </div>
    </button>
  );
}

function FullRecipe({ recipe, onBack }) {
  return (
    <section className="ct-recipe" aria-labelledby="generated-recipe-title">
      <div className="ct-recipe-top">
        <button type="button" className="ct-recipe-back" onClick={onBack}>
          <ArrowLeft size={17} aria-hidden="true" />
          Back to ideas
        </button>
        <div className="ct-recipe-intro">
          <div>
            <SectionLabel number="03" light>
              Your full recipe
            </SectionLabel>
            <h2 id="generated-recipe-title">{recipe.name}</h2>
            {recipe.description ? (
              <p className="ct-recipe-description">{recipe.description}</p>
            ) : null}
          </div>
          <dl className="ct-recipe-metrics">
            {[
              ["Servings", displayValue(recipe.servings)],
              ["Total time", displayValue(recipe.totalTime)],
              ["Difficulty", displayValue(recipe.difficulty)],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      <div className="ct-recipe-content">
        <section className="ct-recipe-ingredients">
          <SectionLabel number="01">What you need</SectionLabel>
          <h3>Ingredients</h3>
          <ul className="ct-recipe-list">
            {(Array.isArray(recipe.ingredients) ? recipe.ingredients : []).map(
              (ingredient, index) => (
                <li
                  key={`${ingredient.item}-${index}`}
                  className="ct-ingredient"
                >
                  <div>
                    <p className="ct-ingredient-name">{ingredient.item}</p>
                    {ingredient.note ? (
                      <p className="ct-ingredient-note">{ingredient.note}</p>
                    ) : null}
                  </div>
                  <span className="ct-ingredient-amount">
                    {displayValue(ingredient.amount, "As needed")}
                  </span>
                </li>
              )
            )}
          </ul>
          {Array.isArray(recipe.substitutions) &&
          recipe.substitutions.length > 0 ? (
            <div className="ct-recipe-tip">
              <h4>
                <RotateCcw size={16} aria-hidden="true" />
                Substitutions
              </h4>
              <ul>
                {recipe.substitutions.map((item, index) => (
                  <li key={`${item}-${index}`}>• {item}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
        <section className="ct-recipe-method">
          <SectionLabel number="02">The method</SectionLabel>
          <h3>Cook it step by step</h3>
          <ol className="ct-recipe-list">
            {(Array.isArray(recipe.steps) ? recipe.steps : []).map(
              (step, index) => (
                <li className="ct-method-row" key={`${step.step}-${index}`}>
                  <span className="ct-method-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <p className="ct-method-text">{step.instruction}</p>
                    {step.time ? (
                      <p className="ct-method-time">
                        <Clock3 size={14} aria-hidden="true" />
                        {step.time}
                      </p>
                    ) : null}
                  </div>
                </li>
              )
            )}
          </ol>
          {Array.isArray(recipe.tips) && recipe.tips.length > 0 ? (
            <div className="ct-recipe-tip">
              <h4>Helpful tips</h4>
              <ul>
                {recipe.tips.map((item, index) => (
                  <li key={`${item}-${index}`}>• {item}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </div>
      <div className="ct-recipe-disclaimer">
        AI-generated instructions can vary. Check allergens, ingredient
        suitability and safe cooking temperatures before preparing food.
      </div>
    </section>
  );
}

const EXAMPLE_INGREDIENTS = [
  { label: "Rice & vegetables", value: "Rice, carrots, peas, onions" },
  { label: "Potatoes & spices", value: "Potatoes, onions, tomatoes, cumin" },
  { label: "Pasta & tomatoes", value: "Pasta, tomatoes, garlic, olive oil" },
];

const STAGES = [
  {
    number: "01",
    title: "Share ingredients",
    detail: "Start with food you have.",
  },
  { number: "02", title: "Choose a dish", detail: "Explore suggested ideas." },
  {
    number: "03",
    title: "Cook with a guide",
    detail: "Get steps for your choice.",
  },
];

export default function AiCookTodayPage() {
  const location = useLocation();
  const [landingHandoffQuery] = useState(() => {
    const navigationQuery = String(
      location.state?.landingCookQuery || ""
    ).trim();
    if (navigationQuery) return navigationQuery;
    try {
      return String(
        window.sessionStorage.getItem(LANDING_COOK_QUERY_KEY) || ""
      ).trim();
    } catch {
      return "";
    }
  });

  const [ingredients, setIngredients] = useState(landingHandoffQuery);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [loadingRecipe, setLoadingRecipe] = useState(false);
  const [error, setError] = useState("");
  const landingRequestStartedRef = useRef(false);

  useEffect(() => {
    if (!landingHandoffQuery || landingRequestStartedRef.current) return;
    landingRequestStartedRef.current = true;
    try {
      window.sessionStorage.removeItem(LANDING_COOK_QUERY_KEY);
    } catch {
      // Navigation state already carries the ingredient input when storage is unavailable.
    }
    void requestSuggestions(landingHandoffQuery);
  }, [landingHandoffQuery]);

  async function requestSuggestions(normalizedIngredients) {
    setLoadingSuggestions(true);
    setSelectedRecipe(null);
    setError("");
    try {
      const data = await generateAiCook({
        action: "suggestions",
        ingredients: normalizedIngredients,
      });
      setSuggestions(Array.isArray(data?.suggestions) ? data.suggestions : []);
    } catch (requestError) {
      setSuggestions([]);
      setError(
        requestError?.message || "Unable to generate cooking ideas right now."
      );
    } finally {
      setLoadingSuggestions(false);
    }
  }

  async function handleFindIdeas(event) {
    event.preventDefault();
    const normalizedIngredients = ingredients.trim();
    if (!normalizedIngredients) {
      setError("Tell me at least one ingredient you have.");
      return;
    }
    await requestSuggestions(normalizedIngredients);
  }

  async function handleSelectSuggestion(suggestion) {
    if (!suggestion?.name || loadingRecipe) return;
    setLoadingRecipe(true);
    setError("");
    try {
      const data = await generateAiCook({
        action: "recipe",
        ingredients: ingredients.trim(),
        dishName: suggestion.name,
      });
      setSelectedRecipe(data?.recipe || null);
    } catch (requestError) {
      setError(
        requestError?.message || "Unable to generate the full recipe right now."
      );
    } finally {
      setLoadingRecipe(false);
    }
  }

  return (
    <main className="ct-page">
      <style>{COOK_STUDIO_CSS}</style>
      <div className="ct-wrap">
        {!landingHandoffQuery ? (
          <nav className="ct-back" aria-label="Back to dashboard">
            <Link to="/dashboard">
              <ArrowLeft size={16} aria-hidden="true" />
              Dashboard
            </Link>
          </nav>
        ) : null}
        <section className="ct-hero" aria-label="Cook Today Studio">
          <div className="ct-story">
            <div>
              <SectionLabel light>
                Cook Today / Your kitchen, your menu
              </SectionLabel>
              <h1>
                <span className="ct-copy-desktop">
                  Something delicious starts with <em>what you have.</em>
                </span>
                <span className="ct-copy-mobile">
                  Cook with <em>what you have.</em>
                </span>
              </h1>
              <p className="ct-story-lede">
                <span className="ct-copy-desktop">
                  A few everyday ingredients can become a meal worth making.
                  Tell us what is in your kitchen and choose what sounds good.
                </span>
                <span className="ct-copy-mobile">
                  Turn what you have into something delicious.
                </span>
              </p>
            </div>
            <div className="ct-journey" aria-label="How Cook Today works">
              <p className="ct-journey-title">Your path from pantry to plate</p>
              <ol className="ct-journey-steps">
                {STAGES.map((stage) => (
                  <li key={stage.number} className="ct-journey-step">
                    <span className="ct-journey-step-num">{stage.number}</span>
                    <strong>{stage.title}</strong>
                    <span>{stage.detail}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <div className="ct-editor">
            <div className="ct-editor-main">
              {landingHandoffQuery ? (
                <div>
                  <SectionLabel number="01">Ingredients received</SectionLabel>
                  <h2>Your ingredients are ready.</h2>
                  <p className="ct-editor-sub">From the Home page:</p>
                  <div className="ct-handoff">{landingHandoffQuery}</div>
                  <div className="ct-status" role="status" aria-live="polite">
                    {loadingSuggestions ? (
                      <LoaderCircle
                        size={20}
                        className="animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <span aria-hidden="true">✓</span>
                    )}
                    {loadingSuggestions
                      ? "Finding dish ideas for you…"
                      : "Ingredients received from Home"}
                  </div>
                  <p className="ct-handoff-note">
                    Choose a dish from the suggestions below when they are
                    ready.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleFindIdeas} className="ct-editor-form">
                  <SectionLabel number="01">Let's get cooking</SectionLabel>
                  <h2>What's in your kitchen?</h2>
                  <p className="ct-editor-sub">
                    List a few ingredients. We'll suggest dishes you can
                    explore.
                  </p>
                  <label
                    htmlFor="cook-today-ingredients"
                    className="ct-field-label"
                  >
                    Your ingredients
                  </label>
                  <textarea
                    id="cook-today-ingredients"
                    value={ingredients}
                    onChange={(event) => setIngredients(event.target.value)}
                    rows={5}
                    placeholder="E.g. chicken, onions, tomatoes, rice, yogurt and spices…"
                    className="ct-textarea"
                  />
                  <div
                    className="ct-examples"
                    aria-label="Example ingredient lists"
                  >
                    <span className="ct-examples-label">Try an example</span>
                    {EXAMPLE_INGREDIENTS.map((example) => (
                      <button
                        key={example.label}
                        type="button"
                        className="ct-example"
                        onClick={() => setIngredients(example.value)}
                      >
                        {example.label}
                      </button>
                    ))}
                  </div>
                  {error ? (
                    <div role="alert" className="ct-error">
                      {error}
                    </div>
                  ) : null}
                  <button
                    type="submit"
                    disabled={loadingSuggestions}
                    className="ct-submit"
                  >
                    <span className="inline-flex items-center gap-3">
                      {loadingSuggestions ? (
                        <LoaderCircle
                          size={19}
                          className="animate-spin"
                          aria-hidden="true"
                        />
                      ) : null}
                      {loadingSuggestions
                        ? "Finding cooking ideas…"
                        : "Show me what I can cook"}
                    </span>
                    <span className="ct-submit-icon">
                      <ArrowRight size={20} aria-hidden="true" />
                    </span>
                  </button>
                </form>
              )}
              <p className="ct-safety">
                AI suggestions can vary. Always check allergens and follow safe
                cooking practices.
              </p>
            </div>
          </div>
        </section>

        {landingHandoffQuery && error ? (
          <div role="alert" className="ct-error">
            {error}
          </div>
        ) : null}
        {loadingRecipe ? (
          <section role="status" aria-live="polite" className="ct-loading">
            <LoaderCircle
              size={26}
              className="animate-spin"
              aria-hidden="true"
            />
            <div>
              <h2>Building your recipe…</h2>
              <p>
                Your chosen dish is being turned into ingredients and cooking
                steps.
              </p>
            </div>
          </section>
        ) : null}
        {!loadingRecipe && selectedRecipe ? (
          <FullRecipe
            recipe={selectedRecipe}
            onBack={() => setSelectedRecipe(null)}
          />
        ) : null}
        {!selectedRecipe && suggestions.length > 0 ? (
          <section
            className="ct-results"
            aria-labelledby="cook-suggestions-title"
          >
            <div className="ct-result-header">
              <div>
                <SectionLabel number="02">Choose a dish</SectionLabel>
                <h2 id="cook-suggestions-title">What you could cook</h2>
              </div>
              <p>
                Select an idea to get its complete recipe and cooking steps.
              </p>
            </div>
            <div className="ct-ideas">
              {suggestions.map((suggestion, index) => (
                <SuggestionCard
                  key={`${suggestion.name}-${index}`}
                  suggestion={suggestion}
                  index={index}
                  onSelect={handleSelectSuggestion}
                  loading={loadingRecipe}
                />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
