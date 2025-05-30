# Novu Bridge App

This is a [Novu](https://novu.co/) bridge application bootstrapped with [`npx novu init`](https://www.npmjs.com/package/novu)

## Getting Started

1.启动网页服务 

To run the development server, run:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

2.启动novu服务
````
npx novu@latest dev
````


### 说明
````
在本地可以创建一个 “.env.local”

NOVU_SECRET_KEY=4ecfd7c91cbf57e55fe580e506de0444
NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER=9qx6L0Q4PsCk
NEXT_PUBLIC_NOVU_SUBSCRIBER_ID=68304373f43b5880d2685acd

````

By default, the [Next.js](https://nextjs.org/) server will start and your state can be synchronized with Novu Cloud via the Bridge Endpoint (default is `/api/novu`). Your server will by default run on [http://localhost:4000](http://localhost:4000).

## Your first workflow

Your first email workflow can be edited in `./app/novu/workflows.ts`. You can adjust your workflow to your liking.

## Learn More

To learn more about Novu, take a look at the following resources:

- [Novu](https://novu.co/)

You can check out [Novu GitHub repository](https://github.com/novuhq/novu) - your feedback and contributions are welcome!
