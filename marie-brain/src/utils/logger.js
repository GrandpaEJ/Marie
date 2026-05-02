import chalk from 'chalk';
const logger = {
    info: (msg) => console.log(`${chalk.blue('ℹ')} ${chalk.cyan(msg)}`),
    success: (msg) => console.log(`${chalk.green('✔')} ${chalk.greenBright(msg)}`),
    warn: (msg) => console.log(`${chalk.yellow('⚠')} ${chalk.yellow(msg)}`),
    error: (msg, err) => {
        console.log(`${chalk.red('✖')} ${chalk.red(msg)}`);
        if (err)
            console.error(err);
    },
    command: (cmd, user, thread) => {
        console.log(`${chalk.magenta('⚙')} Command: ${chalk.white(cmd)} | User: ${chalk.grey(user)} | Thread: ${chalk.grey(thread)}`);
    }
};
export default logger;
