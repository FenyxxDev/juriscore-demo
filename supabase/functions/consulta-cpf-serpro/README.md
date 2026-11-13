# consulta-cpf-serpro

Edge Function server-side para consultar CPF pela API Consulta CPF do Serpro.

## Request

`POST /functions/v1/consulta-cpf-serpro`

Headers:

```text
Authorization: Bearer <sessão Supabase do usuário>
Content-Type: application/json
```

Body:

```json
{
  "cpf": "000.000.000-00",
  "birthDate": "1990-01-31"
}
```

A API V3 do Serpro exige CPF e data de nascimento. A função aceita a data em `YYYY-MM-DD` e envia ao Serpro no formato `DDMMAAAA`.

## Secrets necessários

Configurar no Supabase, sem colocar no frontend ou no repositório:

```text
SERPRO_CONSUMER_KEY
SERPRO_CONSUMER_SECRET
```

Opcionalmente:

```text
SERPRO_CPF_BASE_URL=https://gateway.apiserpro.serpro.gov.br/consulta-cpf-df/v3
SERPRO_CPF_ALLOWED_ORIGINS=https://juriscore-demo.vercel.app,http://localhost:5173
```

Para o ambiente Trial documentado pelo Serpro, use a base indicada na documentação de demonstração. Não use credenciais de Trial em produção.

## Response de sucesso

```json
{
  "ok": true,
  "partial": false,
  "data": {
    "cpf": "00000000000",
    "name": "NOME",
    "socialName": null,
    "birthDate": "31011990",
    "registrationDate": "01012010",
    "statusCode": "0",
    "statusDescription": "Regular"
  }
}
```

A resposta é sanitizada e não repassa o payload bruto do fornecedor ao navegador.

## Segurança implementada

- Exige sessão Supabase válida.
- Mantém as credenciais do Serpro exclusivamente no runtime da Edge Function.
- Valida dígitos do CPF localmente.
- Valida a data de nascimento antes de consumir a API.
- Aplica limite de 5 consultas por usuário por janela de 60 segundos no runtime.
- Limita o corpo da requisição a 2 KiB.
- Restringe CORS aos domínios configurados.
- Não retorna mensagens brutas ou credenciais do Serpro.
- Não persiste automaticamente os dados consultados; a confirmação e o salvamento no cliente devem ocorrer no frontend em uma etapa separada.
