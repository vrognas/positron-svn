# Contributing

Before you contribute to this project, please open an issue beforehand to discuss the changes you want to make.

## Development setup

Requirements
* [Git](https://git-scm.com/)
* [NodeJs](https://nodejs.org/) >= 20.x
* [npm](https://www.npmjs.com/) >= 10.x

First you will need to fork the project
![Github Fork](images/docs/fork.png)

Then clone your fork
```
git clone https://github.com/<YOUR_USERNAME>/svn-scm.git
```

### Dependencies
To install all of the required dependencies run
```
npm ci
```

### Build
To build the extension
```
npm run build
```

### Watch
For development run in watch mode
```
npm run compile
```

### Formatting
This project uses [prettier](https://prettier.io/) for code formatting. You can run prettier across the code by calling `npm run style-fix`

### Linting
This project uses [ESLint](https://eslint.org/) for code linting. You can run ESLint across the code by calling `npm run lint`. To fix fixable errors run `npm run lint:fix`

### Debugging
Run in VS Code
1. Open the `svn-scm` folder
2. Make sure the [dependencies](#dependencies) are installed
3. Run in [watch](#watch) mode
4. Choose the `Launch Extension` launch configuration from the launch dropdown in the Debug viewlet and press `F5`.
