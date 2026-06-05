import { Link } from "react-router-dom";

function NotFoundPage() {
  return (
    <section className="page-section">
      <div className="page-heading compact">
        <p className="eyebrow">Unknown route</p>
        <h1>Page not found</h1>
      </div>
      <Link className="primary-button" to="/">
        Back to instructions
      </Link>
    </section>
  );
}

export default NotFoundPage;
