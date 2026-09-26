"""Prova de que o check_acessibilidade.js morde. (Regra no 12)

Um teste que nunca falha nao prova nada. Este mete uma animacao infinita
nova no style.css SEM alternativa no bloco prefers-reduced-motion, para
se ver que o teste a acusa -- e depois restaura o ficheiro exactamente
como estava.

    python tests\\mutacao_acessibilidade.py           # mete a mutacao
    # ... correr o check_acessibilidade.js no browser, tem de acusar 1
    python tests\\mutacao_acessibilidade.py restaurar  # desfaz

O teste so inspeciona a FOLHA LIGADA (procura o href que contenha
style.css), por isso uma mutacao feita com um <style> injectado na
pagina lhe e' invisivel. Por isso a mutacao tem de estar no ficheiro.
"""
import io
import sys

ALVO = 'static/style.css'
MARCADOR = '/* MUTACAO DE TESTE -- tem de ser apagada */'
MUTACAO = (
    '\n' + MARCADOR + '\n'
    '.mut-test{animation:mut-flash 1.4s ease-in-out infinite}\n'
    '@keyframes mut-flash{0%,100%{opacity:.3}50%{opacity:1}}\n'
)

s = io.open(ALVO, encoding='utf-8').read()

if 'restaurar' in sys.argv:
    limpo = s.replace(MUTACAO, '')
    io.open(ALVO, 'w', encoding='utf-8', newline='').write(limpo)
    print('restaurado. A marcacao ainda esta no ficheiro? '
          + ('SIM, ALGO CORREU MAL' if MARCADOR in limpo else 'nao, esta limpo'))
elif MARCADOR in s:
    print('a mutacao ja esta posta. Corre o check_acessibilidade, '
          + 'depois "restaurar".')
else:
    io.open(ALVO, 'w', encoding='utf-8', newline='').write(s + MUTACAO)
    print('mutacao posta: ".mut-test" anima em infinite e nao tem '
          + 'alternativa em prefers-reduced-motion.')
    print('espera-se que o check_acessibilidade acuse 1 problema.')
