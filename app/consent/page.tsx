import { Suspense } from "react";
import Consent from "./consent";
export default function Page() {return <Suspense fallback={<p className="p-8">Loading authorization…</p>}><Consent/></Suspense>;}
