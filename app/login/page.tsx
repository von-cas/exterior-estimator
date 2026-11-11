import { LoginForm } from "./LoginForm";
import { Logo } from "@/components/Logo";

export default function Login() {
  return (
    <div className="login-page">
      <section className="login-art">
        <span className="brand"><Logo /> Exterior Estimator</span>
        <div>
          <h1>AI reads.<br />Code calculates.<br /><em>People approve.</em></h1>
          <House />
        </div>
        <ol className="steps">
          <li><span>01</span><b>AI reads</b>It copies the numbers from the measurement report, with the page each came from.</li>
          <li><span>02</span><b>Code calculates</b>Every number is checked against its page, then priced with the workings shown.</li>
          <li><span>03</span><b>People approve</b>Measurements, the estimate and each purchase order.</li>
        </ol>
      </section>
      <section className="login-side">
        <div className="panel login">
          <h1>Sign in</h1>
          <p className="muted">Roofing, siding, windows and gutters, from one measurement report.</p>
          <LoginForm />
        </div>
      </section>
    </div>
  );
}

// Decorative line drawing; the dimensions are not real data.
function House() {
  return (
    <svg className="house" viewBox="0 0 480 290" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <g stroke="#c9d4de" strokeWidth="1.6">
        <path d="M20 250h440" opacity=".45" />
        <path d="M110 250V143M370 143v107" />
        <path d="M88 152 240 58l152 94" />
        <path d="M312 103V72h22v44" />
        <rect x="222" y="188" width="40" height="62" />
        <rect x="138" y="170" width="52" height="40" /><path d="M164 170v40M138 190h52" />
        <rect x="294" y="170" width="52" height="40" /><path d="M320 170v40M294 190h52" />
        <path d="M110 160h260" opacity=".35" />
      </g>
      <g stroke="#e58a55" strokeWidth="1.2">
        <path d="M110 272h260M110 266v12M370 266v12" />
        <path d="M410 143v107M404 143h12M404 250h12" />
        <path d="M100 118 232 36M100 118l-3-6M232 36l3 6" strokeDasharray="4 4" />
      </g>
      <g fill="#f0a274" fontFamily="var(--mono-font)" fontSize="11" stroke="none">
        <text x="240" y="287" textAnchor="middle">40&apos; 0&quot;</text>
        <text x="424" y="200">9&apos; 2&quot;</text>
        <text x="120" y="62">6/12 pitch</text>
      </g>
    </svg>
  );
}
