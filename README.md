# LLumen Proxy

This project is a proxy for the OpenAI API server, with additional features.

## Features

- **PDF Text Extraction**: Extracts text from PDF files.
- **Simplified to Traditional Chinese Conversion**: Converts Simplified Chinese to Traditional Chinese.
- **`<think>` Tag Processing**: Converts `<think></think>/reasoning_content` to a `reasoning` field.
- **Online Search**: Performs online searches and inserts a citation XML at the end of the output.

## Usage

1.  Create a `.env` file with the following content:

    ```
    UPSTREAM_API=https://api.openai.com/v1
    TAVILY_API_KEY=<your_tavily_api_key>
    ```

2.  Run the proxy server:

    ```
    deno task start
    ```

3.  Make requests to `http://localhost:8000` instead of the OpenAI API server.

    To enable online search, append `:online` to the model name in your request. For example:

    ```json
    {
      "model": "gpt-3.5-turbo:online",
      "messages": [
        {
          "role": "user",
          "content": "What is the weather in Taipei?"
        }
      ]
    }
    ```