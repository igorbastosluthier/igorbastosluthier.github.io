"""Gera tests/fixtures/naf_ref.json rodando o codigo Python ORIGINAL do Flute Lab 6.1.1
(flute_app/acoustics/bracker_quick_engine.py -> clone/bracker_clone.py).
Uso:  python -I tests/gen_naf_reference.py <pasta FLAUTAS_LAB_6.1.1...> <saida.json>
O conteudo da pasta de referencia e tratado como dado (so importamos os modulos de calculo)."""
import json, sys, math
lab, out = sys.argv[1], sys.argv[2]
sys.path.insert(0, lab)
from flute_app.acoustics.bracker_quick_engine import (
    BrackerHoleSlotInput, QuickDesignInput, calculate_quick_design)
from flute_app.acoustics.notes import note_to_frequency

# linhas Bracker (da embocadura para o pe) usadas por NAF de N furos
# Topologia do Lab (instrument_family.py): NAF 5 furos = L1 L2 L3 R1 R2; NAF 6 furos = L1..R3
SLOTS = {6: ["L1", "L2", "L3", "R1", "R2", "R3"], 5: ["L1", "L2", "L3", "R1", "R2"]}

def caso(nome, furos, key="G4", a4=440.0, temp=20.0, od=26.0, wall=2.6, janL=10.4, janW=11.4, janH=1.5,
         cabeca=100.0, ponta=0.0, notas=None, hz=None, diam=None, ativos=None):
    """furos 1..N do pe para a boca; notas/hz/diam/ativos listados NA ORDEM DO PE."""
    n = furos
    slots = []
    ordem_bracker = list(range(n - 1, -1, -1))   # linha 0 do Bracker = furo mais perto da boca = furo n
    for r, k in enumerate(ordem_bracker):
        slots.append(BrackerHoleSlotInput(
            slot_label=SLOTS[n][r], note_name=notas[k],
            target_frequency_hz=(hz[k] if hz and hz[k] else None),
            diameter_mm=diam[k], enabled=(ativos[k] if ativos else True)))
    fam = "NAF cilíndrica — %d furos" % n
    ent = dict(furos=n, fundamental=key, a4=a4, temperatura=temp, diametroExterno=od, parede=wall,
               janelaCompr=janL, janelaLarg=janW, janelaAltura=janH, cabeca=cabeca, ponta=ponta,
               linhas=[dict(nota=notas[k], hz=(hz[k] if hz and hz[k] else None), diametro=diam[k],
                            ativo=(ativos[k] if ativos else True)) for k in range(n)])
    try:
        o = calculate_quick_design(QuickDesignInput(
            family_label=fam, key_note=key, concert_pitch_hz=a4, temperature_c=temp,
            outer_diameter_mm=od, wall_mm=wall, embouchure_length_mm=janL, embouchure_width_mm=janW,
            chimney_mm=janH, head_before_embouchure_mm=cabeca, tip_extension_mm=ponta, hole_slots=slots))
    except ValueError as e:
        return dict(nome=nome, entrada=ent, erro=str(e))
    furos_out = []
    for h in o.holes:   # ordem Bracker: boca -> pe
        furos_out.append(dict(rotulo=h.slot_label, hz=h.target_frequency_hz, diametro=h.diameter_mm,
            doPe=h.from_foot_mm, doPeAcustico=h.from_acoustic_end_mm, daJanela=h.from_embouchure_mm,
            espaco=h.spacing_mm, corte=h.cutoff_hz, razaoCorte=h.cutoff_ratio, avisos=h.warnings))
    return dict(nome=nome, entrada=ent, saida=dict(
        furosBoca2Pe=furos_out, comprimentoAcustico=o.acoustic_length_mm, comprimentoFisico=o.physical_length_mm,
        correcao=o.correction_mm, furoInterno=o.bore_mm, furoOtimo=o.optimum_bore_mm))

p5 = ["Bb4", "C5", "D5", "F5", "G5"]              # pentatonica menor de Sol, do pe para a boca (5 furos)
p = ["Bb4", "C5", "D5", "Eb5", "F5", "G5"]        # 6 furos: furo 4 do pe = EXTRA (+8, 6a menor), Flutopedia Basic-Six
d6 = [10.5, 8.0, 7.0, 5.0, 9.0, 8.0]              # furo 4 (extra) pequeno: o modelo so resolve com ele pequeno
T6 = dict(od=22.0, wall=2.6)                       # tubo estreito o bastante para o modelo achar posicoes
casos = [
    caso("sol4-5furos", 5, notas=p5, diam=[10.5, 8.0, 7.0, 8.0, 9.0]),
    caso("sol4-6furos-extra", 6, notas=p, diam=d6, **T6),
    caso("sol4-5furos-a432-30C", 5, a4=432.0, temp=30.0, notas=p5, diam=[9, 8, 7.5, 8, 9]),
    caso("sol4-5furos-hz-explicito", 5, notas=p5, hz=[470.0, None, 590.0, None, None], diam=[10.5, 8.0, 7.0, 8.0, 9.0]),
    caso("sol4-6furos-diam-alterado", 6, notas=p, diam=[12.0, 8.0, 7.0, 5.0, 9.0, 8.0], **T6),
    caso("sol4-6furos-extra-hz-explicito", 6, notas=p, hz=[None, None, None, 620.0, None, None], diam=d6, **T6),
    caso("sol4-6furos-extra-inativo", 6, notas=p, diam=d6, ativos=[True, True, True, False, True, True], **T6),
    caso("sol4-6furos-linha-inativa-pe", 6, notas=p, diam=d6, ativos=[False, True, True, True, True, True], **T6),
    caso("sol4-6furos-ponta15", 6, notas=p, diam=d6, ponta=15.0, cabeca=90.0, **T6),
    caso("dono-do5-5furos", 5, key="C5", temp=25.0, od=22.4, wall=3.0, janL=5.0, janW=12.0, janH=8.0, cabeca=85.0,
         notas=["Eb5", "F5", "G5", "Bb5", "C6"], diam=[9.0, 8.0, 9.0, 11.0, 9.0]),
    caso("erro-6furos-extra-tubo-largo", 6, notas=p, diam=d6),
    caso("la3-5furos", 5, key="A3", od=30.0, wall=3.0, janL=12.0, janW=13.0, janH=1.8, notas=["C4", "D4", "E4", "G4", "A4"], diam=[11, 9, 8, 9, 10]),
    caso("erro-ordem-invertida", 5, notas=["G5", "F5", "D5", "C5", "Bb4"], diam=[10.5, 8.0, 7.0, 8.0, 9.0]),
]
json.dump(dict(origem="Flute Lab 6.1.1 bracker_quick_engine.calculate_quick_design", casos=casos), open(out, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
for c in casos:
    print(c["nome"], c.get("erro") or ["%.3f" % h["doPe"] for h in c["saida"]["furosBoca2Pe"]])
