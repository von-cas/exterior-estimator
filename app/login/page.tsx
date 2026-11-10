import { LoginForm } from "./LoginForm";

export default function Login() {
  return (
    <div className="panel login">
      <h1>Exterior Estimator</h1>
      <p className="muted">AI reads. Code calculates. People approve.</p>
      <LoginForm />
    </div>
  );
}
