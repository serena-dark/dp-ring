import { AppLink } from "@ring-gui/lib/router";

export default function NotFound() {
  return (
    <div className="page">
      <section className="panel">
        <h3>404</h3>
        <AppLink to="/" className="button">
          Dashboard
        </AppLink>
      </section>
    </div>
  );
}
