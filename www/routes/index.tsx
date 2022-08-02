/** @jsx h */
import { h } from "vue";
import { hashAssetPath } from "../../src/runtime.ts";
import { Head } from "../../src/server.ts";

export default () => {
  return (
    <body class="bg-red-700">
      <img src={hashAssetPath("/nadder.svg")} height="128px" />
      <p>
        Welcome to `nadder`. Try updating this message in the ./routes/index.tsx
        file, and refresh.
      </p>
      <Head id="123">
        {() => [
          <link rel="stylesheet" href="/style.css" />,
          <link rel="stylesheet" href="/style.css" />,
        ]}
      </Head>
    </body>
  );
};
