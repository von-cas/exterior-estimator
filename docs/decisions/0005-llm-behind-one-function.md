# 5. The LLM sits behind one function, and reads text

**Decision.** One function, `readReport`, takes the report's text page by page
and returns a fixed JSON shape checked by a schema. Provider, model and key
are settings. This build calls OpenRouter's OpenAI-compatible API with a free
model that supports schema-enforced JSON, and a second model as fallback.

**Why.** Nothing else in the app knows which model is used, so it can change
without touching the rest. HOVER PDFs carry a text layer, so a text model is
enough and costs little or nothing. Every value carries its page, and code confirms the
value appears on that page, so a misread is caught instead of trusted.

**Rejected.** Tying the app to one provider's file or vision features.

**Consequence.** A scanned PDF with no text layer cannot be read this way. That
case needs a model that reads page images, plugged into the same function. The
answer may also come back empty or in the wrong shape; it is retried once and
then sent to a person. Free models are rate limited and may change or
disappear, so the model is tested against the sample report before it is
trusted, and production would use a paid model with a data-retention policy
that suits customer documents.
