"""Gera tests/fixtures/escalas_app.json a partir do app da oficina (flute_scales.py): graus de cada escala e a
montagem dos furos (layout) para 5, 6 e 7 furos. Rodar: python tests/gen_escalas_app.py [pasta codigo do app]"""
import json, sys, types, pathlib
app = sys.argv[1] if len(sys.argv) > 1 else r"C:\CNC\Igor\PROGRAMAS\Aplainar Superfície\codigo"
sys.path.insert(0, app)
sys.modules["flute_lab_backend"] = types.SimpleNamespace(load_engine=None)
sys.modules["flute_acoustics"] = types.SimpleNamespace(AcousticDesign=None, suggest_cutoff_design=None)
import flute_scales as F
out = {"graus": {k: list(v) for k, v in F.SCALES.items()},
       "layout": {str(n): {k: {"furos": list(F.layout(k, n)[0]), "aux": list(F.layout(k, n)[1]), "fora": list(F.layout(k, n)[2])} for k in F.SCALES} for n in (5, 6, 7)},
       "padrao": {"naf": F.default_scale("NAF"), "pife": F.default_scale("Pífano transversal")}}
dest = pathlib.Path(__file__).parent / "fixtures" / "escalas_app.json"
dest.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
print("ok:", dest)
