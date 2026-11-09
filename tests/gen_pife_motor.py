"""Gera tests/fixtures/pife_motor.json: posições do pé e dos furos do pífano calculadas pelo motor do app da oficina
(Motor Único, motor/design.py) para os mesmos tubos e furos que o site sugere. Referência de tests/pife_motor.test.js.
Rodar (na raiz do site):  node -e "..." gera os casos; ou simplesmente:
    python tests/gen_pife_motor.py [pasta codigo do app]
Precisa do node (para os furos sugeridos do site) e do app instalado."""
import sys, json, subprocess, pathlib
from dataclasses import replace

app = sys.argv[1] if len(sys.argv) > 1 else r"C:\CNC\Igor\PROGRAMAS\Aplainar Superfície\codigo"
sys.path.insert(0, app)
from motor.design import Inputs, solve
from motor._reference.acoustics.bracker_quick_engine import BrackerHoleSlotInput

raiz = pathlib.Path(__file__).resolve().parent.parent
CASOS = [["sol", 18, 4, 10], ["sol", 18, 3, 10], ["sol", 19, 4.5, 11], ["do", 17, 3, 9], ["do", 17, 4, 9.5], ["re-agudo", 15, 3, 8],
         ["re-agudo", 15, 2.5, 9], ["sol", 16, 3.5, 8.5], ["do", 15, 2.5, 8], ["re-agudo", 17, 4, 9], ["sol", 17, 2.5, 10], ["do", 19, 3.5, 11]]
js = ("const P=require('./assets/pife-calc.js');const C=" + json.dumps(CASOS) + ";console.log(JSON.stringify(C.map(([tom,D,t,emb])=>{"
      "const e={tom,la:440,temp:25,D,parede:t,emb,embForma:'redondo',furos:[]};e.furos=P.otimizarFuros(e);const r=P.calcular(e);"
      "return {tom,midi:r.tom.midi,D,t,emb,rolha:r.rolha,furos:r.furos.map(h=>({d:h.diametro,f:h.freq}))};})))")
site = json.loads(subprocess.check_output(["node", "-e", js], cwd=raiz, text=True))
nomes = {67: "G4", 72: "C5", 74: "D5"}
saida = []
for p in site:
    D, t = p["D"], p["t"]; head = p["rolha"] + 25; fur = list(reversed(p["furos"]))
    base = Inputs(family_label="Pífano transversal", key_note=nomes[p["midi"]], outer_diameter_mm=D + 2 * t, wall_mm=t, temperature_c=25,
                  head_before_embouchure_mm=head, stopper_distance_mm=p["rolha"], embouchure_length_mm=p["emb"], embouchure_width_mm=p["emb"],
                  chimney_mm=t, bore_kind="Cilíndrico", ergonomic_layout=False)
    slots = [BrackerHoleSlotInput(slot_label=l, hole_id=i + 1, target_frequency_hz=h["f"], diameter_mm=h["d"])
             for i, (l, h) in enumerate(zip(("L1", "L2", "L3", "R1", "R2", "R3"), fur))]
    out = solve(replace(base, hole_slots=slots))
    xs = [m.from_embouchure_mm for m in sorted(out.holes, key=lambda h: -h.from_embouchure_mm)]
    saida.append({"tom": nomes[p["midi"]], "D": D, "parede": t, "emb": p["emb"], "furos": [h["d"] for h in p["furos"]],
                  "motor": {"bocaAoPe": round(out.physical_length_mm - head, 2), "daBoca": [round(x, 2) for x in xs]},
                  "convergiu": bool(out.result.converged)})
(raiz / "tests" / "fixtures" / "pife_motor.json").write_text(json.dumps(saida, indent=1), encoding="utf-8")
print("casos:", len(saida))
