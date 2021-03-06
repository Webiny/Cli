#! /usr/bin/env node
const program = require('commander');
const _ = require('lodash');
const chalk = require('chalk');
const readline = require('readline');

const checkUpdates = require('./lib/boot/checkUpdates');
const setup = require('./lib/boot/setup');
const Webiny = require('./lib/webiny');

class WebinyCli {
    constructor() {
        this.updateAvailable = null;
        this.version = JSON.parse(Webiny.readFile(__dirname + '/package.json')).version;

        program
            .version(this.version)
            .description([
                'Webiny CLI tool will help you manage your project from development to deployment.',
                'It supports plugins so you are welcome to develop new plugins for your project and connect to the existing plugins using hooks.',
                'Run without arguments to enter GUI mode.',
                '',
                'Visit https://www.webiny.com/ for tutorials and documentation.'
            ].join('\n  '))
            .option('--show-timestamps [format]', 'Show timestamps next to each console message');

        program
            .command('setup')
            .description('Setup Webiny project.')
            .option('--user [user]', 'Admin user email.')
            .option('--password [password]', 'Admin user password.')
            .option('--url [url]', 'Project domain.') // https://github.com/tj/commander.js/issues/370
            .option('--database [database]', 'Database name')
            .option('--cliPort [cliPort]', 'CLI port')
            .action((cmd) => {
                const config = cmd.opts();
                config.domain = config.url;

                setup(false, config).then(() => process.exit(0)).catch(e => {
                    console.log(e.message);
                    process.exit(1);
                });
            });

        program
            .command('*', null, {noHelp: true})
            .action(cmd => {
                Webiny.failure(`${chalk.magenta(cmd)} is not a valid command. Run ${chalk.magenta('webiny-cli -h')} to see all available commands.`);
                process.exit(1);
            });

        this.attachExitHandler();

        // Load plugins
        readline.cursorTo(process.stdout, 0);
        process.stdout.write('Loading plugins...');
        Webiny.getPlugins();
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0, null);
    }

    exit() {
        if (this.updateAvailable) {
            const {currentVersion, latestVersion} = this.updateAvailable;
            const line = '---------------------------------------------';
            Webiny.log('\n' + chalk.green(line));
            Webiny.success('Update available: ' + chalk.green(latestVersion) + chalk.grey(' (current: ' + currentVersion + ')'));
            Webiny.info('Run ' + chalk.blue('yarn add webiny-cli@' + latestVersion) + ' to update');
            Webiny.log(chalk.green(line) + '\n');
        }
    }

    run() {
        program.parse(process.argv);

        if (program.showTimestamps) {
            require('console-stamp')(console, _.isString(program.showTimestamps) ? program.showTimestamps : 'HH:MM:ss.l');
        }

        checkUpdates(this.version).then(update => this.updateAvailable = update);

        if (program.args.length === 0) {
            Webiny.log('---------------------------------------------');
            Webiny.info('Webiny CLI ' + chalk.cyan('v' + this.version));
            Webiny.log('---------------------------------------------');
            const checkRequirements = require('./lib/boot/checkRequirements');
            if (!checkRequirements.firstRun()) {
                return Webiny.renderMenu();
            }

            try {
                // First run will check the system requirements and setup the platform
                if (process.env.WEBINY_ENVIRONMENT !== 'docker') {
                    Webiny.log('Checking requirements...');
                    checkRequirements.requirements();
                    Webiny.success("Great, all the requirements are in order!");
                }

                Webiny.log("\nSetting up the platform...");
                return setup().then(answers => {
                    Webiny.log(`\n-------------------------------------`);
                    Webiny.success('Platform setup is now completed!');
                    Webiny.info(`You are now ready to run your first development build! Select "Develop!" from the menu and hit ENTER.\nAfter the development build is completed, navigate to ` + chalk.magenta(answers.domain + '/admin') + ` to see your brand new administration system!`);
                    Webiny.log('-------------------------------------');
                    Webiny.renderMenu();
                }).catch(e => {
                    Webiny.failure(e.message, e);
                });
            } catch (err) {
                Webiny.exclamation('Setup failed with the following problem:', err);
                process.exit(1);
            }
        }
    }

    attachExitHandler() {
        if (process.platform === "win32") {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            rl.on("SIGINT", () => {
                process.emit("SIGINT");
            });
        }

        // Listen for process exit
        process.on('exit', this.exit.bind(this));

        // Ctrl+C event
        process.on('SIGINT', () => {
            process.exit(0);
        });
    }
}

module.exports = WebinyCli;