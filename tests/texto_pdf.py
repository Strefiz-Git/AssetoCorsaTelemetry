# -*- coding: utf-8 -*-
"""Extrai texto de um PDF, sem instalar nada.

PORQUEE ISTE EXISTE
-------------------
Para comparar a nossa `protocolo.py` com a especificacao mais recente da
EA. Nao ha `pypdf`, nem `PyPDF2`, nem `pymupdf`, nem `pdfminer`, nem
`pdftotext` nesta maquina -- e instalar um pacote para ler um ficheiro e'
mexer no ambiente de quem nao pediu.

Um PDF de texto e' um conjunto de streams comprimidos com `zlib`, e o texto
esta' nos operadores `Tj` e `TJ`. O `zlib` vem na biblioteca padrao,
portanto chega.

E O QUE ISTO NAO E'
-------------------
Nao e' um leitor de PDF. Nao sabe paginas, nem colunas, nem a ordem visual;
nao sabe os esquemas de codificacao (`ToUnicode` CMaps) -- e' por isso que
os acentos podem sair trocados; e nao ve imagens.

Para o que e' preciso -- uma tabela de campos e os seus tipos, num
documento da EA -- chega. E o que nao chegar diz-se que nao chegou, em vez
de se inventar a leitura (Regra no 9).

USO
    python tests\texto_pdf.py <ficheiro.pdf> [termo-a-procurar]
"""
import io
import re
import sys
import zlib

STREAMS = re.compile(rb'stream\r?\n(.*?)endstream', re.S)
OPERADORES = re.compile(rb'\((?:\\.|[^()\\])*\)')


def descomprime(bruto):
    for m in STREAMS.finditer(bruto):
        s = m.group(1)
        try:
            yield zlib.decompress(s)
        except zlib.error:
            if b'Tj' in s or b'TJ' in s:
                yield s


def texto_de(fluxo):
    partes = []
    for m in OPERADORES.finditer(fluxo):
        cru = re.sub(rb'\\([()\\])', rb'\1', m.group(0)[1:-1])
        try:
            partes.append(cru.decode('latin-1'))
        except Exception:
            pass
    return partes


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    p = sys.argv[1]
    try:
        bruto = io.open(p, 'rb').read()
    except OSError as e:
        raise SystemExit('  nao abri %s: %s' % (p, e))

    palavras = []
    for fluxo in descomprime(bruto):
        palavras.extend(texto_de(fluxo))
    junto = re.sub(r'\n+', ' ', '\n'.join(palavras))

    print('  %s' % p)
    print('  %d bytes, %d streams, %d fragmentos, %d caracteres'
          % (len(bruto), len(STREAMS.findall(bruto)), len(palavras), len(junto)))

    if len(sys.argv) > 2:
        alvo = sys.argv[2]
        print('')
        print('  a procurar %r:' % alvo)
        n = 0
        for m in re.finditer(re.escape(alvo), junto, re.I):
            a = max(0, m.start() - 120)
            print('    ...%s...' % junto[a:m.end() + 200].strip())
            n += 1
            if n >= 10:
                print('    ... e mais')
                break
        if not n:
            print('    NADA. Ou nao existe, ou o texto nao saiu legivel.')
            print('    E "nao saiu" e um resultado, nao uma falha a ignorar.')
        return
    print('')
    print(junto[:1500])


if __name__ == '__main__':
    main()
